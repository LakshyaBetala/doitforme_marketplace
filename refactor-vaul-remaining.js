const fs = require('fs');
const file = 'c:/Users/laksh/doitforme1/app/gig/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldContact = `{/* CONTACT REVEAL MODAL (P2P) */}
      {showContactModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-brand-pink/30 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-[0_0_50px_rgba(236,72,153,0.2)]">
            <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-brand-pink/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                <CheckCircle className="w-8 h-8 text-brand-pink" />
              </div>

              <h2 className="text-2xl font-bold text-white">Contact Revealed!</h2>
              <p className="text-white/50 text-sm">
                Connect directly with the poster to finalize the deal.
                <br /><span className="text-brand-pink font-bold">Meet in a safe public place.</span>
              </p>

              <div className="bg-black/40 rounded-xl p-6 border border-white/5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Name</label>
                  <p className="text-lg font-bold text-white">{posterDetails?.name || "Poster"}</p>
                </div>

                {posterDetails?.phone && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Phone</label>
                    <p className="text-xl font-mono text-brand-pink tracking-wider select-all">{posterDetails.phone}</p>
                  </div>
                )}

                {posterDetails?.upi_id && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">UPI ID</label>
                    <p className="text-base font-mono text-white/80 select-all">{posterDetails.upi_id}</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => router.push(\`/chat/\${id}\`)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                >
                  Close & Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}`;

const newContact = `{/* CONTACT REVEAL DRAWER (P2P) */}
      <Drawer.Root open={showContactModal} onOpenChange={setShowContactModal}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex flex-col rounded-t-[32px] bg-[#1A1A24] border-t border-brand-pink/30 p-6 md:p-8 outline-none shadow-[0_-20px_50px_rgba(236,72,153,0.15)]">
            <div className="mx-auto mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-white/20" />
            <div className="max-w-md w-full mx-auto mb-[env(safe-area-inset-bottom)] text-center space-y-4">
              <div className="w-16 h-16 bg-brand-pink/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                <CheckCircle className="w-8 h-8 text-brand-pink" />
              </div>

              <h2 className="text-2xl font-bold text-white">Contact Revealed!</h2>
              <p className="text-white/50 text-sm">
                Connect directly with the poster to finalize the deal.
                <br /><span className="text-brand-pink font-bold">Meet in a safe public place.</span>
              </p>

              <div className="bg-black/40 rounded-xl p-6 border border-white/5 space-y-4 text-left">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Name</label>
                  <p className="text-lg font-bold text-white">{posterDetails?.name || "Poster"}</p>
                </div>

                {posterDetails?.phone && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Phone</label>
                    <p className="text-xl font-mono text-brand-pink tracking-wider select-all">{posterDetails.phone}</p>
                  </div>
                )}

                {posterDetails?.upi_id && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">UPI ID</label>
                    <p className="text-base font-mono text-white/80 select-all">{posterDetails.upi_id}</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => router.push(\`/chat/\${id}\`)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                >
                  Close & Chat
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>`;

const oldReturn = `{/* RETURN MODAL (Owner) */}
      {showReturnModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowReturnModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold text-center mb-2">Confirm Return</h2>
            <p className="text-center text-white/50 text-sm mb-6">Verify the item condition and release deposit.</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/60">Deduction Amount (₹)</label>
                <input
                  type="number"
                  value={deductionAmount}
                  onChange={(e) => setDeductionAmount(Number(e.target.value))}
                  max={gig.security_deposit || 0}
                  className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono"
                />
                <p className="text-xs text-white/40">Max Deduction: ₹{gig.security_deposit || 0}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-xl flex justify-between items-center text-sm">
                <span>Refund to Renter:</span>
                <span className="font-bold text-green-400 font-mono">₹{(gig.security_deposit || 0) - deductionAmount}</span>
              </div>

              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Condition notes..."
                className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none"
              />

              <button onClick={confirmReturn} disabled={isCompleting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-5 h-5" />} Process Return
              </button>
            </div>
          </div>
        </div>
      )}`;

const newReturn = `{/* RETURN DRAWER (Owner) */}
      <Drawer.Root open={showReturnModal} onOpenChange={setShowReturnModal}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex flex-col rounded-t-[32px] bg-[#1A1A24] border-t border-white/10 p-6 md:p-8 outline-none">
            <div className="mx-auto mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-white/20" />
            <div className="max-w-md w-full mx-auto mb-[env(safe-area-inset-bottom)]">
              <h2 className="text-2xl font-bold text-center mb-2">Confirm Return</h2>
              <p className="text-center text-white/50 text-sm mb-6">Verify the item condition and release deposit.</p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/60">Deduction Amount (₹)</label>
                  <input
                    type="number"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(Number(e.target.value))}
                    max={gig?.security_deposit || 0}
                    className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono"
                  />
                  <p className="text-xs text-white/40">Max Deduction: ₹{gig?.security_deposit || 0}</p>
                </div>

                <div className="p-4 bg-white/5 rounded-xl flex justify-between items-center text-sm">
                  <span>Refund to Renter:</span>
                  <span className="font-bold text-green-400 font-mono">₹{(gig?.security_deposit || 0) - deductionAmount}</span>
                </div>

                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Condition notes..."
                  className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none"
                />

                <button onClick={confirmReturn} disabled={isCompleting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all mb-4">
                  {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-5 h-5" />} Process Return
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>`;

const oldReview = `{/* REVIEW MODAL (Hustle/General) */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowReviewModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold text-center mb-2">Rate Experience</h2>
            <div className="flex justify-center gap-3 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)}><Star className={\`w-10 h-10 \${star <= rating ? "fill-yellow-500 text-yellow-500" : "text-white/10"}\`} /></button>
              ))}
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Review the work..." className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 mb-6 h-32 outline-none text-white" />
            <button onClick={submitReview} disabled={isCompleting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-5 h-5" />} Approve & Release Funds
            </button>
          </div>
        </div>
      )}`;

const newReview = `{/* REVIEW DRAWER (Hustle/General) */}
      <Drawer.Root open={showReviewModal} onOpenChange={setShowReviewModal}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex flex-col rounded-t-[32px] bg-[#1A1A24] border-t border-white/10 p-6 md:p-8 outline-none">
            <div className="mx-auto mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-white/20" />
            <div className="max-w-md w-full mx-auto mb-[env(safe-area-inset-bottom)]">
              <h2 className="text-2xl font-bold text-center mb-2">Rate Experience</h2>
              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)}><Star className={\`w-10 h-10 \${star <= rating ? "fill-yellow-500 text-yellow-500" : "text-white/10"}\`} /></button>
                ))}
              </div>
              <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Review the work..." className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 mb-6 h-32 outline-none text-white resize-none" />
              <button onClick={submitReview} disabled={isCompleting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all mb-4">
                {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-5 h-5" />} Approve & Release Funds
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>`;

content = content.replace(oldContact, newContact);
content = content.replace(oldReturn, newReturn);
content = content.replace(oldReview, newReview);

fs.writeFileSync(file, content, 'utf8');
console.log("Replaced remaining modals with Vaul Drawers");
