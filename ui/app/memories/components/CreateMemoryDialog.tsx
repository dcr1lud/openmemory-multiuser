"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect } from "react";
import { GoPlus } from "react-icons/go";
import { Loader2 } from "lucide-react";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export function CreateMemoryDialog() {
  const { createMemory, isLoading, notification, error, fetchMemories } = useMemoriesApi();
  const [open, setOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Show toast when notification changes
  useEffect(() => {
    if (notification) {
      try {
        // Handle both string and object cases
        const notificationObj = typeof notification === 'string'
          ? JSON.parse(notification)
          : notification;

        if (notificationObj && notificationObj.type && notificationObj.message) {
          switch (notificationObj.type) {
            case "success":
              toast.success(notificationObj.message);
              setOpen(false);
              fetchMemories();
              break;
            case "warning":
              toast.warning(notificationObj.message);
              // Don't close dialog or refresh for warnings
              break;
            case "error":
              toast.error(notificationObj.message);
              // Don't close dialog or refresh for errors
              break;
            case "info":
              toast(notificationObj.message);
              setOpen(false);
              fetchMemories();
              break;
            default:
              toast.success(notificationObj.message);
              setOpen(false);
              fetchMemories();
          }
        }
      } catch (e) {
        // Fallback for plain string notifications
        toast.success(typeof notification === 'string' ? notification : 'Memory created successfully');
        setOpen(false);
        fetchMemories();
      }
    }
  }, [notification, fetchMemories]);

  const handleCreateMemory = async (text: string) => {
    await createMemory(text, () => setOpen(false));
    // Hook handles all toasts internally
    // Dialog closes only on success via callback
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <GoPlus />
          Create Memory
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Create New Memory</DialogTitle>
          <DialogDescription>
            Add a new memory to your OpenMemory instance
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="memory">Memory</Label>
            <Textarea
              ref={textRef}
              id="memory"
              placeholder="e.g., Lives in San Francisco"
              className="bg-zinc-950 border-zinc-800 min-h-[150px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={isLoading}
            onClick={() => handleCreateMemory(textRef?.current?.value || "")}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              "Save Memory"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
