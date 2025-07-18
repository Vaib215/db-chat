"use client";

import { ConfigDialog } from "@/components/config";
import { useChat } from "@ai-sdk/react";
import { useConfig } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, DatabaseIcon, Loader2, AlertCircle, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useEffect, useState } from "react";

// Define interfaces
interface DBError {
  message: string;
  toolName?: string;
}

export default function Chat() {
  const { apiKey, dbUrl, customInstructions } = useConfig();
  const [dbError, setDbError] = useState<DBError | null>(null);
  const [fixContext, setFixContext] = useState("");
  const [isFixing, setIsFixing] = useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
  } = useChat({
    body: {
      apiKey,
      dbUrl,
      customInstructions,
    },
    onResponse: (response) => {
      // Check for DB error in headers
      const dbErrorHeader = response.headers.get("X-DB-Error");
      if (dbErrorHeader) {
        try {
          const parsedError = JSON.parse(dbErrorHeader);
          setDbError(parsedError);
        } catch (e) {
          console.error("Failed to parse DB error", e);
        }
      } else {
        setDbError(null);
      }

      // Reset fixing state when response comes back
      setIsFixing(false);
    },
  });

  // Function to handle AutoFix
  const handleAutoFix = () => {
    if (!dbError) return;

    // Set fixing state
    setIsFixing(true);

    // Send a request with the fixError parameter
    reload({
      body: {
        apiKey,
        dbUrl,
        customInstructions,
        fixError: dbError,
        fixContext: fixContext,
      },
    });

    // Clear the fix context and error after submitting
    setFixContext("");
    setDbError(null);
  };

  // Handle general errors
  useEffect(() => {
    if (error) {
      console.log("General error:", error);
    }
  }, [error]);

  // Check for errors in messages content
  useEffect(() => {
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // Check for error message patterns in the content
      if (lastMessage.role === "assistant") {
        // Extract any error from formatted assistant messages
        let match = null;
        let content = "";

        // Get content from message text parts
        for (const part of lastMessage.parts || []) {
          if (part.type === "text" && typeof part.text === "string") {
            content += part.text;
          }
        }

        // Also check direct content property
        if (typeof lastMessage.content === "string") {
          content = lastMessage.content;
        }

        // Look for error patterns
        if (content && content.includes("Database Error:")) {
          match = content.match(/Database Error: (.*?)(?:\n|$)/);
          if (match && match[1]) {
            setDbError({ message: match[1] });
          }
        }

        // Check if message has special properties indicating an error
        const messageAny = lastMessage as any;
        if (messageAny.error === true && messageAny.errorType === "database") {
          if (messageAny.errorDetails) {
            setDbError(messageAny.errorDetails);
          }
        }
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1c] text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Postgres Chat Interface</h1>
        <div className="flex items-center gap-2">
          <ConfigDialog />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-zinc-400">
              <DatabaseIcon size={48} strokeWidth={1} />
              <h2 className="text-xl font-medium mb-2">
                Welcome to Postgres Chat
              </h2>
              <p>Ask questions about your database using natural language</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="mb-4">
                <div
                  className={`rounded-lg max-w-screen-lg w-fit px-4 py-3 ${
                    message.role === "user"
                      ? "bg-zinc-700 text-white ml-auto"
                      : "bg-zinc-800 text-white mr-auto"
                  }`}
                >
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <div
                            key={`${message.id}-${i}`}
                            className="prose prose-invert prose-sm max-w-none"
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                            >
                              {part.text?.split("The following Python")[0] ||
                                ""}
                            </ReactMarkdown>
                          </div>
                        );
                      case "tool-invocation":
                        return (
                          <div
                            key={`${message.id}-${i}`}
                            className="flex self-start cursor-pointer w-fit mb-2 rounded-md items-center bg-slate-500 text-xs gap-2 p-1"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                part.toolInvocation.args?.sql || ""
                              );
                            }}
                          >
                            {part.toolInvocation.state === "partial-call" ? (
                              <Loader2 className="animate-spin" size={18} />
                            ) : (
                              <DatabaseIcon size={18} />
                            )}
                            <span>{part.toolInvocation.args?.sql}</span>
                          </div>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              </div>
            ))
          )}

          {/* Database Error Message */}
          {dbError && (
            <div className="rounded-lg px-4 py-3 bg-red-900/50 border border-red-700 text-white mr-12 my-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Database Error</p>
                  <p className="text-sm text-red-200 mb-3">{dbError.message}</p>

                  {/* Add additional context input field */}
                  <div className="mb-3">
                    <p className="text-xs text-red-200 mb-1">
                      Add any additional context to help fix this error:
                    </p>
                    <Input
                      className="bg-red-950/50 border-red-700 text-white text-sm placeholder:text-red-300/50"
                      placeholder="e.g., correct column name, enum value..."
                      value={fixContext}
                      onChange={(e) => setFixContext(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleAutoFix}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    size="sm"
                    disabled={isFixing}
                  >
                    {isFixing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    {isFixing ? "Fixing..." : "AutoFix"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div>
              <div className="rounded-lg px-4 py-3 bg-zinc-800 text-white mr-12">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-800 p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 text-lg font-mono">
                N
              </div>
              <Input
                className="flex-1 bg-zinc-900 border-zinc-700 pl-8 text-white placeholder:text-zinc-500"
                value={input}
                placeholder="about your database..."
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
