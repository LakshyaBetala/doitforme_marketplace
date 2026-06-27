import os
import sys
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Missing Supabase credentials in environment variables.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def view_hot_leads():
    response = supabase.table("outbound_leads").select("*").eq("status", "pitched").order("posted_at", descending=True).execute()
    leads = response.data
    
    if not leads:
        print("\n⚡ No fresh high-value pitches waiting for review.")
        return
        
    print(f"\n🚀 Found {len(leads)} READY-TO-SEND PITCHES:")
    print("="*60)
    
    for idx, lead in enumerate(leads, 1):
        print(f"\n[{idx}] {lead['title'].upper()}")
        print(f"🔗 URL: {lead['url']}")
        print(f"💰 BUDGET: {lead['budget']}")
        print(f"--- GENERATED PROPOSAL ---")
        print(lead['personalized_pitch'])
        print("="*60)

if __name__ == "__main__":
    view_hot_leads()
