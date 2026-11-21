"use client";

import * as React from "react";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface IssuedApiKey {
  title: string;
  keyPrefix: string;
  token: string;
}

/**
 * The one moment the secret exists outside the caller's memory.
 *
 * Only a SHA-256 hash of it is stored, so this dialog is the single place it
 * is ever shown: close it without copying and the key has to be rotated.
 *
 * It therefore **refuses to close** until the operator has either copied the
 * token or ticked the acknowledgement. Escape and an outside click both route
 * through `onOpenChange`, which is where that refusal lives - a dialog that
 * can be dismissed by a stray click is how a key gets lost.
 */
export function ApiKeySecretDialog({
  issued,
  onClose,
}: {
  issued: IssuedApiKey | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

  // Reset per key, so a second issue does not inherit the first's consent.
  React.useEffect(() => {
    if (issued) {
      setCopied(false);
      setAcknowledged(false);
    }
  }, [issued]);

  const mayClose = copied || acknowledged;

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      toast.success("Key copied");
    } catch {
      // Clipboard access is denied over plain HTTP on a non-localhost host,
      // which is exactly where someone would be setting this up. Say so,
      // rather than failing silently - the token is selectable below.
      toast.error("Could not copy. Select the key and copy it manually.");
    }
  }

  return (
    <Dialog
      open={issued !== null}
      onOpenChange={(open) => {
        if (open) return;
        if (!mayClose) {
          toast.error("Copy the key first — it cannot be shown again.");
          return;
        }
        onClose();
      }}
    >
      {/* Both set from the same gate: before consent there is no close button
          and the overlay/Escape route through onOpenChange above, which
          refuses. Afterwards both work normally. */}
      <DialogContent showCloseButton={mayClose} dismissible={mayClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Copy this key now
          </DialogTitle>
          <DialogDescription>
            {issued?.title
              ? `“${issued.title}” is ready.`
              : "The key is ready."}{" "}
            This is the only time it is shown — only a hash of it is stored, so a
            lost key is rotated, not recovered.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="issued-token">API key</Label>
            <div className="flex items-start gap-2">
              <code
                id="issued-token"
                className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs whitespace-pre"
              >
                {issued?.token}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={() => void copy()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span className="sr-only">Copy</span>
              </Button>
            </div>
          </div>

          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <TriangleAlert className="size-4 shrink-0 text-amber-600" />
            <p>
              Send it to the application that will use it as the{" "}
              <code>x-api-key</code> header, or as{" "}
              <code>Authorization: Bearer</code>. Treat it like a password: it
              identifies the application, not a person.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="ack"
              checked={acknowledged}
              onCheckedChange={(value) => setAcknowledged(value === true)}
            />
            <Label htmlFor="ack" className="text-sm font-normal">
              I have stored this key somewhere safe
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose} disabled={!mayClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
