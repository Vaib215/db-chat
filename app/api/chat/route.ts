import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "ai/mcp-stdio";
import { NextResponse } from "next/server";

export const maxDuration = 120;

// Error interface
interface DbError {
  message: string;
  toolName?: string;
}

export async function POST(req: Request) {
  let mcpClient: any = null;
  try {
    const {
      messages,
      apiKey,
      dbUrl,
      customInstructions,
      fixError,
      fixContext,
    } = await req.json();
    const google = createGoogleGenerativeAI({
      apiKey: apiKey,
    });
    mcpClient = await createMCPClient({
      transport: new StdioMCPTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres", dbUrl],
      }),
    });

    const tools = await mcpClient.tools();
    const date = new Date();

    // If this is an error fix request
    if (fixError) {
      const errorMessage = fixError.message || "Unknown database error";
      const errorSql = fixError.sql || "";

      // Build the prompt with user's additional context if provided
      let userContext = "";
      if (fixContext && fixContext.trim() !== "") {
        userContext = `\n\nAdditional context from the user: "${fixContext}"`;
      }

      const fixSystemPrompt = `You are a SQL Error Fixer. A database query has failed with the error: "${errorMessage}".
      Your task is to analyze the error and suggest a fixed query.
      
      Based on common PostgreSQL errors:
      - If column doesn't exist: Check table schema and correct column name
      - If enum value is invalid: Check the valid enum values and use correct casing
      - If syntax error: Fix syntax according to PostgreSQL standards
      - If table doesn't exist: Check schema for correct table name
      
      ${errorSql ? `The failing query was: ${errorSql}` : ""}${userContext}
      
      Provide a brief explanation of what was wrong and the fixed query and run the new query using query tool`;

      const fixResult = streamText({
        model: google("gemini-2.5-flash"),
        system: fixSystemPrompt,
        messages: [
          { role: "user", content: `Fix this database error: ${errorMessage}` },
        ],
        tools,
        maxSteps: 50,
        onFinish: async () => {
          if (mcpClient) await mcpClient.close();
        },
        onError: async (error) => {
          console.error("Error during fix:", error);
        },
      });

      return fixResult.toDataStreamResponse();
    }

    // Base system prompt
    let systemPrompt = `You are a DB Query Assistant. Your task is to help users query and analyze database information. 

    Date: ${date.toLocaleString()}

       When using the query tool:
        - First, diagnose the database tables and schema by running exploratory queries (e.g., "SELECT table_name FROM information_schema.tables WHERE table_schema = "public";" and "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = "table_name";").
        - Based on the schema information, frame your final query to get the most accurate results
        - Find things in case insensitive manner
        - Break your response into multiple steps
        - Table names are case sensitive. USe double quotes for them
        - Column names are case sensitive. Use single quotes for them

      When displaying query results:
        - ALWAYS place query results in a table format
        - For complex data or very wide tables, select only the most relevant columns
        - Add a brief explanation of the results after the table

      Never mention or include any python libraries that are available.
      ALWAYS USE POSTGRES SYNTAX, NOT ANY OTHER SQL SYNTAX.

      Never include technical details in the response

      You can use the query tool multiple times.
  [MUST] THE LAST CALL SHOULD BE A TEXT RESPONSE WITH MESSAGE: ✅`;

    if (customInstructions) {
      systemPrompt += `\n\n      Custom Instructions from the user:\n      ${customInstructions}`;
    }

    // Modified approach: use custom error interceptor to inject error messages for the client
    const originalToolHandler = tools.query.handler;
    tools.query.handler = async (args: any) => {
      try {
        return await originalToolHandler(args);
      } catch (toolError: any) {
        // Format error for client-side display
        const errorMessage =
          toolError?.cause?.message ||
          toolError?.message ||
          "Unknown database error";

        // Format response as error message that client can recognize
        const errorObject = {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: true,
                errorType: "database",
                message: errorMessage,
                sql: args.sql,
              }),
            },
          ],
          isError: true,
        };

        console.error(`SQL Error: ${errorMessage} in query: ${args.sql}`);
        return errorObject;
      }
    };

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 200,
      onFinish: async () => {
        if (mcpClient) await mcpClient.close();
      },
      onError: async ({ error }) => {
        console.log("ERROR", error);
      },
    });

    try {
      return result.toDataStreamResponse();
    } catch (streamError: any) {
      // This catches streaming errors that happen during query execution
      console.error("Stream error:", streamError);

      // Extract error message from the stream error
      let errorMessage = "Unknown database error";
      let toolName = null;
      let sql = "";

      // Try to extract error from the stream error
      if (streamError?.cause?.cause?.message) {
        errorMessage = streamError.cause.cause.message;
        toolName = streamError.toolName;
        sql = streamError.toolArgs?.sql || "";
      } else if (typeof streamError === "object" && streamError !== null) {
        // Look for error message in nested properties
        const errorObj = JSON.stringify(streamError);
        const errorMatch = errorObj.match(/"message":\s*"([^"]+)"/);
        if (errorMatch && errorMatch[1]) {
          errorMessage = errorMatch[1];
        }

        // Try to extract SQL
        const sqlMatch = errorObj.match(/"sql":\s*"([^"]+)"/);
        if (sqlMatch && sqlMatch[1]) {
          sql = sqlMatch[1];
        }
      }

      // Create a response that the client can display with an AutoFix button
      return new Response(
        JSON.stringify({
          id: "error-" + Date.now(),
          role: "assistant",
          content: `⚠️ Database Error: ${errorMessage}\n\nUse the "AutoFix" button to attempt to fix this error.`,
          error: true,
          errorType: "database",
          errorDetails: {
            message: errorMessage,
            toolName,
            sql,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-DB-Error": JSON.stringify({
              message: errorMessage,
              toolName,
              sql,
            }),
          },
        }
      );
    }
  } catch (err: any) {
    // Final error handler for request parsing errors
    console.error("API route error:", err);

    // Try to extract error message
    const errorMessage = err?.message || "Unknown error occurred";

    // Always close MCP client on error
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (closeError) {
        console.error("Error closing MCP client:", closeError);
      }
    }

    return new Response(
      JSON.stringify({
        id: "error-" + Date.now(),
        role: "assistant",
        content: `⚠️ Error: ${errorMessage}`,
        error: true,
        errorType: "database",
        errorDetails: {
          message: errorMessage,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-DB-Error": JSON.stringify({ message: errorMessage }),
        },
      }
    );
  }
}
