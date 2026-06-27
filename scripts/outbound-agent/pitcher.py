import os
import sys
from datetime import datetime, timezone
import google.generativeai as genai
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
ASVA_DEMO_URL = os.environ.get("ASVA_DEMO_URL", "https://tryasva.com")  # Fallback link

if not all([SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY]):
    print("Missing critical environment configurations (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY).")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# Engineering Persona Setup for High Conversion Pitching
SYSTEM_INSTRUCTION = """
You are an Elite Lead AI Engineer at Almmatix, a high-velocity software engineering studio. 
Your goal is to write a punchy, highly technical proposal for a client based on their job posting.

Rules for your message:
1. No generic greetings ("Dear hiring manager", "I hope you are well"). Start directly with the core problem statement.
2. Pitch the ASVA infrastructure layer: multilingual voice automation (Tamil, English, Hindi), ultra-low latency routing, WhatsApp workflow orchestration, and automated CRM tracking.
3. Be direct, authoritative, and consultative. Do not sound like a desperate freelancer. Sound like an engineering partner who has already built the architecture they are looking for.
4. Keep the sentence structure short, impactful, and easily scannable using bullet points.
5. Do not hallucinate or promise impossible timelines.
6. End with a single clear CTA referencing our production demo: {demo_url}
"""

def generate_all_pitches():
    # Fetch all leads waiting for an engineering proposal
    response = supabase.table("outbound_leads").select("*").eq("status", "scraped").execute()
    leads = response.data
    
    if not leads:
        print("No new leads waiting for pitch generation.")
        return

    print(f"Found {len(leads)} leads to process.")
    
    # Correct model instantiation with system_instruction
    model = genai.GenerativeModel(
        model_name='gemini-1.5-flash',
        system_instruction=SYSTEM_INSTRUCTION.format(demo_url=ASVA_DEMO_URL)
    )

    for lead in leads:
        print(f"Structuring pitch for: {lead['title']}")
        
        prompt = f"""
        Job Title: {lead['title']}
        Platform: {lead['platform']}
        Stated Budget: {lead['budget']}
        Job Description: {lead['description']}
        
        Write an executive proposal matching this specification. Insert this exact URL as the product demo resource: {ASVA_DEMO_URL}
        """
        
        try:
            ai_response = model.generate_content(
                prompt,
                generation_config={"temperature": 0.3}
            )
            
            pitch_text = ai_response.text
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Correct Python Supabase client syntax for filter and timestamps
            supabase.table("outbound_leads").update({
                "personalized_pitch": pitch_text,
                "status": "pitched",
                "updated_at": now_iso
            }).eq("id", lead["id"]).execute()
            
            print(f"Successfully generated pitch for: {lead['title']}")
            
        except Exception as e:
            print(f"Failed to generate pitch sequence for lead {lead['id']}: {e}")

if __name__ == "__main__":
    generate_all_pitches()
