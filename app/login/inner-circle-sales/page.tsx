import { redirect } from "next/navigation";

// Shorter branded path for the Round 1 return-login.
//
// Candidates who've already claimed their invite and need to sign back in
// (lost tab, different device, cookie expired) use email + DOB. The actual
// form lives at /inner-circle/sales/round-1 so it sits next to the other
// Round 1 pages; this route just redirects there, giving us a URL that reads
// cleanly in email signatures and reminders:
//
//   doitforme.in/login/inner-circle-sales
//
// Both URLs are allowlisted in proxy.ts, so neither bounces off the
// maintenance gate.

export default function Page() {
  redirect("/inner-circle/sales/round-1");
}
