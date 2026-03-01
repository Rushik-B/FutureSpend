import re
from datetime import datetime

def event_type(title):
    title_lower=title.lower()
    if re.search(r'dinner|lunch|brunch|breakfast|restaurant|cafe|food|eat',title_lower):
        return 'meal'
    elif re.search(r'coffee|starbucks|tim hortons|caffeine',title_lower):
        return 'coffee'
    elif re.search(r'concert|movie|theatre|show|game|sports|party|club',title_lower):
        return 'entertainment'
    elif re.search(r'taxi|uber|lyft|transit|bus|train|parking',title_lower):
        return 'transport'
    else:
        return 'other'
def get_time_category(start_time_str):
    try:
        dt=datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        hour=dt.hour
        if 5<=hour<12:
            return 'morning'
        elif 12<=hour<17:
            return 'afternoon'
        elif 17<=hour<21:
            return 'evening'
        else:
            return 'night'
    except:
        return 'unknown'

def get_day_type(start_time_str):
    try:
        dt=datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        if dt.weekday()>=5:
            return 'weekend'
        else:
            return 'weekday'
    except:
        return 'unknown'
def parse_event(event):
    title=event.get('title','')
    start_time=event.get('start_time','')
    location=event.get('location','')
    attendees=event.get('attendees',0)
    features={
        'title':title,
        'event_type':event_type(title),
        'time_category':get_time_category(start_time),
        'day_type':get_day_type(start_time),
        'location':location,
        'attendees':attendees,
        'has_location':bool(location and location.strip())
    }
    return features
def parse_calendar_events(events):
    return [parse_event(event) for event in events]

if __name__=="__main__":
    test_events=[
        {"title": "Dinner with friends", "location": "Earls", "start_time": "2024-03-15T19:00:00", "attendees": 4},
        {"title": "Coffee meeting", "location": "Starbucks", "start_time": "2024-03-16T10:00:00", "attendees": 2},
        {"title": "Concert", "location": "Venue", "start_time": "2024-03-16T20:00:00"},
        {"title": "Gym workout", "start_time": "2024-03-17T08:00:00"}
    ]
    features=parse_calendar_events(test_events)
    for i,f in enumerate(features):
        print(f"Event {i+1}:")
        print(f"  Title: {f['title']}")
        print(f"  Type: {f['event_type']}")
        print(f"  Time category: {f['time_category']}")
        print(f"  Day type: {f['day_type']}")
        print(f"  Location present: {f['has_location']}")
        print(f"  Attendees: {f['attendees']}")
        print()