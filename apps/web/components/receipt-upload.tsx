"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FileText, Image as ImageIcon, Paperclip, Replace, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 10 * 1024 * 1024;

interface ReceiptUploadProps {
  expenseId: Id<"expenses">;
  receiptStorageId: Id<"_storage"> | undefined;
  /** Server values for the remaining parent fields; we forward them on updateDraft
   * so an upload doesn't disturb the user's in-flight local edits. */
  serverParentFields: {
    summary: string;
    currency: "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "JPY";
    expenseDate: number;
    merchant?: string;
  };
  editable: boolean;
}

export function ReceiptUpload({
  expenseId,
  receiptStorageId,
  serverParentFields,
  editable,
}: ReceiptUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateDraft = useMutation(api.expenses.updateDraft);
  const url = useQuery(
    api.files.getReceiptUrl,
    receiptStorageId ? { expenseId } : "skip",
  );

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error("Receipt must be JPG, PNG, WebP, or PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Receipt must be 10MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error(`Upload failed (${result.status})`);
      const { storageId } = (await result.json()) as {
        storageId: Id<"_storage">;
      };
      await updateDraft({
        expenseId,
        parentFields: { ...serverParentFields, receiptStorageId: storageId },
      });
      toast.success("Receipt attached.");
    } catch (err) {
      const message =
        err instanceof ConvexError ? String(err.data) : "Upload failed.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    try {
      await updateDraft({
        expenseId,
        parentFields: { ...serverParentFields, receiptStorageId: null },
      });
      toast.success("Receipt removed.");
    } catch (err) {
      const message =
        err instanceof ConvexError ? String(err.data) : "Could not remove receipt.";
      toast.error(message);
    }
  };

  if (!receiptStorageId) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 flex flex-col items-center justify-center text-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Paperclip size={16} />
        </div>
        <div className="text-sm font-medium">No receipt attached</div>
        <div className="text-xs text-muted-foreground">
          Required to submit. Images or PDF, up to 10MB.
        </div>
        {editable && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-2"
            >
              <Upload size={14} /> {uploading ? "Uploading…" : "Attach receipt"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onPick}
            />
          </>
        )}
      </div>
    );
  }

  const isPdf = url?.toLowerCase().includes(".pdf");
  const isImage = !isPdf;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {isImage ? (
            <ImageIcon size={14} className="text-muted-foreground shrink-0" />
          ) : (
            <FileText size={14} className="text-muted-foreground shrink-0" />
          )}
          <span className="font-medium truncate">
            {isPdf ? "Receipt (PDF)" : "Receipt"}
          </span>
        </div>
        {editable && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Replace size={13} />
              {uploading ? "Uploading…" : "Replace"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={13} />
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onPick}
            />
          </div>
        )}
      </div>
      {url ? (
        isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Receipt"
            className="block w-full max-h-[420px] object-contain bg-muted/30"
          />
        ) : (
          <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 bg-muted/30">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-background border border-border text-red-600 shadow-sm">
              <FileText size={26} />
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-muted-foreground hover:underline"
            >
              Open PDF
            </a>
          </div>
        )
      ) : (
        <div className="receipt-stripes aspect-[4/3] flex items-center justify-center text-muted-foreground text-xs font-mono">
          <div className="rounded-md bg-background/80 backdrop-blur px-3 py-1.5 border border-border">
            Loading receipt…
          </div>
        </div>
      )}
    </div>
  );
}
