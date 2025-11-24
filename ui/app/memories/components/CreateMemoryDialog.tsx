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
    console.log('Notification changed:', notification); // Debug log
    if (notification) {
      try {
        const notificationObj = JSON.parse(notification);
        console.log('Parsed notification:', notificationObj); // Debug log
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
      } catch {
        // Fallback for plain string notifications
        console.log('Using fallback notification:', notification); // Debug log
        toast.success(notification);
        setOpen(false);
        fetchMemories();
      }
    }
  }, [notification, fetchMemories]);

  // Show error toast when error changes
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleCreateMemory = async (text: string) => {
    try {
      await createMemory(text);
      // Success/notification handling is done via useEffect above
    } catch (error: any) {
      // Error handling is done via useEffect above
      console.error(error);

      // Try to parse notification from backend
      try {
        const notification = JSON.parse(error.message);
        if (notification.type && notification.message) {
          // Use backend-controlled notification
          switch (notification.type) {
            case 'success':
              toast.success(notification.message);
              setOpen(false);
              await fetchMemories();
              break;
            case 'info':
              toast(notification.message);
              setOpen(false);
              await fetchMemories();
              break;
            case 'warning':
              toast.warning(notification.message);
              break;
            default:
              toast.error(notification.message);
          }
          return;
        }
      } catch {
        // Not a notification object, handle as regular error
      }

      // Fallback to regular error handling
      const errorMessage = error.response?.data?.detail || error.message || "Failed to create memory";
      toast.error(errorMessage);
    }
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
