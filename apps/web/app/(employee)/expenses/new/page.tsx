"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";

export default function NewExpensePage() {
  const router = useRouter();
  const createDraft = useMutation(api.expenses.createDraft);
  const creating = useRef(false);

  useEffect(() => {
    if (creating.current) return;
    creating.current = true;
    (async () => {
      try {
        const id = await createDraft({
          summary: "",
          currency: "USD",
          expenseDate: Date.now(),
        });
        router.replace(`/expenses/${id}`);
      } catch (err) {
        const message =
          err instanceof ConvexError
            ? String(err.data)
            : "Could not create draft.";
        toast.error(message);
        router.replace("/expenses");
      }
    })();
  }, [createDraft, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="skel h-4 w-32" />
    </div>
  );
}
