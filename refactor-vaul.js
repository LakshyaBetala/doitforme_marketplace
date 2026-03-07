const fs = require('fs');
const file = 'c:/Users/laksh/doitforme1/app/gig/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import { Drawer } from 'vaul'")) {
    content = content.replace(
        "import { load } from '@cashfreepayments/cashfree-js';",
        "import { load } from '@cashfreepayments/cashfree-js';\nimport { Drawer } from 'vaul';"
    );
}

const originalModal = `{/* OFFER / APPLY MODAL */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowOfferModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold text-center mb-2">{isMarket ? (gig.market_type === "RENT" ? "Rental Offer" : "Make an Offer") : "Apply for Gig"}</h2>
            <p className="text-center text-white/50 text-sm mb-6">
              {isMarket ? "Propose your price or accept the listing price." : "Tell the poster why you're a good fit."}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/60">Your Offer (₹)</label>
                <input
                  type="number"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder={gig.price.toString()}
                  className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/60">Message / Pitch</label>
                <textarea
                  value={offerPitch}
                  onChange={(e) => setOfferPitch(e.target.value)}
                  placeholder="I'm interested..."
                  className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none focus:border-brand-purple/50 transition-all"
                />
              </div>

              <button
                onClick={handleMakeOffer}
                disabled={submitting || !offerPrice}
                className="w-full py-4 bg-brand-purple hover:bg-[#7D5FFF] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(136,37,245,0.3)] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />} Send Offer
              </button>
            </div>
          </div>
        </div>
      )}`;

const replacementDrawer = `{/* OFFER / APPLY DRAWER */}
      <Drawer.Root open={showOfferModal} onOpenChange={setShowOfferModal}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex flex-col rounded-t-[32px] bg-[#1A1A24] border-t border-white/10 p-6 md:p-8 outline-none">
            <div className="mx-auto mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-white/20" />
            <div className="max-w-md w-full mx-auto mb-[env(safe-area-inset-bottom)]">
              <h2 className="text-2xl font-bold text-center mb-2">{isMarket ? (gig?.market_type === "RENT" ? "Rental Offer" : "Make an Offer") : "Apply for Gig"}</h2>
              <p className="text-center text-white/50 text-sm mb-6">
                {isMarket ? "Propose your price or accept the listing price." : "Tell the poster why you're a good fit."}
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/60">Your Offer (₹)</label>
                    {gig?.price && (
                      <div className="flex gap-2">
                        <button onClick={() => setOfferPrice(Math.round(gig.price * 0.8).toString())} className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">₹{Math.round(gig.price * 0.8)}</button>
                        <button onClick={() => setOfferPrice(Math.round(gig.price * 0.9).toString())} className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">₹{Math.round(gig.price * 0.9)}</button>
                        <button onClick={() => setOfferPrice(gig.price.toString())} className="text-[10px] px-2 py-1 bg-brand-purple/20 text-brand-purple border border-brand-purple/30 rounded-lg hover:bg-brand-purple/30 transition-colors">Full Price</button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder={gig?.price?.toString()}
                    className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/60">Message / Pitch</label>
                    <div className="flex gap-2">
                       <button onClick={() => setOfferPitch("I can pick this up today!")} className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">Today!</button>
                       {!isMarket && <button onClick={() => setOfferPitch("I'm experienced and ready.")} className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">Expert</button>}
                    </div>
                  </div>
                  <textarea
                    value={offerPitch}
                    onChange={(e) => setOfferPitch(e.target.value)}
                    placeholder="I'm interested..."
                    className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none focus:border-brand-purple/50 transition-all"
                  />
                </div>

                <button
                  onClick={handleMakeOffer}
                  disabled={submitting || !offerPrice}
                  className="w-full py-4 bg-brand-purple hover:bg-[#7D5FFF] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(136,37,245,0.3)] disabled:opacity-50 mb-4"
                >
                  {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />} Send Offer
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>`;

if (content.includes("OFFER / APPLY MODAL")) {
    content = content.replace(originalModal, replacementDrawer);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully replaced offer modal with Vaul Drawer");
} else {
    console.log("Offer modal not found - perhaps already replaced?");
}
