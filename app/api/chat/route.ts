import { streamText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "ai/mcp-stdio";
import { z } from "zod";

const memoryTool = () => {
  return tool({
    description:
      "Memory tool: To store relevant information about the database for later use",
    parameters: z.object({
      memory: z.string().optional(),
    }),
    execute: async ({ memory }) => {
      console.log("");
    },
  });
};

export async function POST(req: Request) {
  try {
    const { messages, apiKey, dbUrl, customInstructions, memory } =
      await req.json();
    const google = createGoogleGenerativeAI({
      apiKey: apiKey,
    });
    const mcpClient = await createMCPClient({
      transport: new StdioMCPTransport({
        command: "bunx",
        args: ["-y", "@modelcontextprotocol/server-postgres", dbUrl],
      }),
    });

    const tools = await mcpClient.tools();
    const allTools = { ...tools, memoryTool: memoryTool() };
    const date = new Date();

    // Base system prompt
    let systemPrompt = `You are a DB Query Assistant. Your task is to help users query and analyze database information. 

    Date: ${date.toLocaleString()}

       When using the query tool:
        - First, diagnose the database tables and schema by running exploratory queries (e.g., "SELECT table_name FROM information_schema.tables WHERE table_schema = "public";" and "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = "table_name";"). Store this in memory. Also no need to run this if it is already in the memory and not explicity asked by the user.
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

      When using memory tool:
      Use memory result to store relevant information so that there is no need to run the same query again and again. Store all the tables names, any schema of table that you use, any custom thing which you think will be useful in future responses also.

      Never include technical details in the response

      You can use the query tool multiple times.
  [MUST] THE LAST CALL SHOULD BE A TEXT RESPONSE WITH MESSAGE: ✅`;

    if (customInstructions) {
      systemPrompt += `\n\n      Custom Instructions from the user:\n      ${customInstructions}`;
    }

    if (memory) {
      systemPrompt += `\n\n      Past Memory :\n      ${memory}`;
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      tools: allTools,
      maxSteps: 200,
      onFinish: async () => {
        await mcpClient.close();
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    return err;
  }
}
