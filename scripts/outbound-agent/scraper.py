import os
import sys
import requests
import feedparser
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Missing Supabase credentials in environment variables.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Define your target search terms converted to Upwork RSS feeds
# Structured to pull high-intent jobs with recency sorting
UPWORK_FEEDS = {
    "AI Automation": "https://www.upwork.com/ab/feed/jobs/rss?q=%22AI+Automation%22+OR+%22AI+Agent%22+OR+%22Voice+Bot%22+OR+%22AI+Integration%22&sort=recency",
    "WhatsApp Workflow": "https://www.upwork.com/ab/feed/jobs/rss?q=WhatsApp+Automation+OR+Twilio+OR+Chatbot+OR+%22CRM+Integration%22&sort=recency",
    "Video Editing": "https://www.upwork.com/ab/feed/jobs/rss?q=%22Video+Editing%22+OR+%22Video+Editor%22+OR+Reels+OR+Shorts+OR+TikTok&sort=recency"
}

# Standard user-agent to bypass basic bot detection
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml"
}

def clean_html(html_content):
    """Strip HTML tags injected into RSS descriptions."""
    soup = BeautifulSoup(html_content, "html.parser")
    # Clean up redundant links/text added by Upwork RSS at the bottom
    text = soup.get_text(separator="\n").strip()
    return text

def extract_budget(summary):
    """Basic structural parsing for Upwork's RSS summary block."""
    try:
        # Create a new BS soup to parse the summary safely
        soup = BeautifulSoup(summary, "html.parser")
        text_lines = soup.get_text(separator="\n").split("\n")
        for line in text_lines:
            if "Hourly Range" in line or "Budget" in line:
                return line.strip()
    except Exception as e:
        print(f"Error parsing budget: {e}")
    return "Not Specified"

def scrape_feeds():
    print("Initiating outbound scrape cycle...")
    new_leads_count = 0
    duplicate_leads_count = 0
    
    for category, url in UPWORK_FEEDS.items():
        print(f"Parsing feed for: {category}")
        try:
            response = requests.get(url, headers=HEADERS, timeout=15)
            if response.status_code != 200:
                print(f"Failed to fetch feed for {category}: HTTP {response.status_code}")
                continue
                
            feed = feedparser.parse(response.content)
            
            if not feed.entries:
                print(f"No jobs found in feed for {category}.")
                continue
                
            for entry in feed.entries:
                # Clean trailing analytics parameters
                job_url = entry.link.split("?")[0] if hasattr(entry, "link") else ""
                if not job_url:
                    continue
                    
                raw_desc = clean_html(entry.summary) if hasattr(entry, "summary") else ""
                budget = extract_budget(entry.summary) if hasattr(entry, "summary") else "Not Specified"
                title = entry.title if hasattr(entry, "title") else "Untitled Job"
                
                payload = {
                    "title": title,
                    "description": raw_desc,
                    "url": job_url,
                    "platform": "upwork",
                    "budget": budget,
                    "status": "scraped"
                }
                
                try:
                    # Upsert safely via Unique URL constraint
                    supabase.table("outbound_leads").upsert(
                        payload, on_conflict="url"
                    ).execute()
                    new_leads_count += 1
                except Exception as e:
                    # Catch duplicate insertions cleanly
                    if "duplicate key value" in str(e):
                        duplicate_leads_count += 1
                    else:
                        print(f"Error saving lead: {e}")
                        
        except Exception as e:
            print(f"Error requesting feed for {category}: {e}")
            
    print(f"Scrape cycle finished. Added {new_leads_count} new leads (skipped {duplicate_leads_count} duplicates).")

if __name__ == "__main__":
    scrape_feeds()
