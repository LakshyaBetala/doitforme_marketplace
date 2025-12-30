"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AdminWithdrawals() {
  const supabase = supabaseBrowser();

  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setRequests(data ?? []);
    })();
  }, []);

  const updateStatus = async (id: string, userId: string, amount: number, status: string) => {
    await fetch("/api/admin/withdrawals/update", {
      method: "POST",
      body: JSON.stringify({
        id,
        userId,
        amount,
        status,
      }),
    });

    setRequests(req =>
      req.map(r => (r.id === id ? { ...r, status } : r))
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Withdrawal Requests</h1>

      <div className="space-y-3">
        {requests.map(r => (
          <div key={r.id} className="bg-white p-4 rounded shadow flex justify-between">
            <div>
              <div>User: {r.user_id}</div>
              <div>Amount: ₹{r.amount}</div>
              <div>UPI: {r.upi_id}</div>
              <div>Status: {r.status}</div>
            </div>
            {r.status === "PENDING" && (
              <div className="space-x-2">
                <button
                  className="bg-green-500 text-white px-3 py-1 rounded"
                  onClick={() => updateStatus(r.id, r.user_id, r.amount, "APPROVED")}
                >
                  Approve
                </button>
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => updateStatus(r.id, r.user_id, r.amount, "REJECTED")}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
