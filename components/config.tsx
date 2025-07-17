import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { useConfig } from "@/lib/context";
import {
  Settings,
  Key,
  Database,
  CheckCircle,
  MessageSquare,
} from "lucide-react";

export function ConfigDialog() {
  const {
    apiKey,
    dbUrl,
    customInstructions,
    setApiKey,
    setDbUrl,
    setCustomInstructions,
  } = useConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const geminiKeyRef = useRef<HTMLInputElement>(null);
  const dbUrlRef = useRef<HTMLInputElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Set initial values when dialog opens
    if (isOpen) {
      if (geminiKeyRef.current) geminiKeyRef.current.value = apiKey || "";
      if (dbUrlRef.current) dbUrlRef.current.value = dbUrl || "";
      if (instructionsRef.current)
        instructionsRef.current.value = customInstructions || "";
    }
  }, [apiKey, dbUrl, customInstructions, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newApiKey = geminiKeyRef.current?.value || "";
    const newDbUrl = dbUrlRef.current?.value || "";
    const newInstructions = instructionsRef.current?.value || "";

    setApiKey(newApiKey);
    setDbUrl(newDbUrl);
    setCustomInstructions(newInstructions);
    setSaveSuccess(true);

    localStorage.setItem("gemini-key", newApiKey);
    localStorage.setItem("postgres-db-url", newDbUrl);
    localStorage.setItem("custom-instructions", newInstructions);

    // Reset success message after a delay
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  };

  const isConfigured = !!apiKey && !!dbUrl;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 hover:text-white"
        >
          <Settings className="h-4 w-4" />
          {isConfigured ? "Settings" : "Configure"}
          {isConfigured && <CheckCircle className="h-3 w-3 text-green-500" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px] bg-zinc-900 border-zinc-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">API Configuration</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure your Gemini API key, Postgres database connection, and
            custom instructions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            <div className="grid gap-3">
              <Label
                htmlFor="gemini-key"
                className="flex items-center gap-2 text-zinc-300"
              >
                <Key className="h-4 w-4" /> Gemini API Key
              </Label>
              <Input
                id="gemini-key"
                name="gemini-key"
                ref={geminiKeyRef}
                defaultValue={apiKey || ""}
                placeholder="Enter your Gemini API key"
                className="font-mono text-sm bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              <p className="text-xs text-zinc-400">
                Get your API key from the{" "}
                <a
                  href="https://ai.google.dev/"
                  className="text-orange-500 hover:text-orange-400 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
            <div className="grid gap-3">
              <Label
                htmlFor="db-url"
                className="flex items-center gap-2 text-zinc-300"
              >
                <Database className="h-4 w-4" /> Postgres Database URL
              </Label>
              <Input
                id="db-url"
                name="db-url"
                ref={dbUrlRef}
                defaultValue={dbUrl || ""}
                placeholder="postgresql://user:password@localhost:5432/dbname"
                className="font-mono text-sm bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              <p className="text-xs text-zinc-400">
                Connection string format:
                postgresql://user:password@host:port/dbname
              </p>
            </div>
            <div className="grid gap-3">
              <Label
                htmlFor="custom-instructions"
                className="flex items-center gap-2 text-zinc-300"
              >
                <MessageSquare className="h-4 w-4" /> Custom Instructions
              </Label>
              <textarea
                id="custom-instructions"
                name="custom-instructions"
                ref={instructionsRef}
                defaultValue={customInstructions || ""}
                placeholder="Add custom instructions for the AI (optional)"
                className="font-mono text-sm bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 rounded-md p-2 h-24 resize-y"
              />
              <p className="text-xs text-zinc-400">
                Add specific instructions for how the AI should analyze your
                database
              </p>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            {saveSuccess && (
              <span className="text-sm text-green-500 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Saved successfully
              </span>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                >
                  Cancel
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Save changes
                </Button>
              </DialogClose>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
