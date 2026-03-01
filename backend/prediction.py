def estimate_spending(features):
    eventType=features.get('event_type','other')
    timeCategory=features.get('time_category','unknown')
    dayType=features.get('day_type','weekday')
    attendees=features.get('attendees',1)
    hasLocation=features.get('has_location',False)

    if eventType=='meal':
        if timeCategory=='evening':
            base=40
        elif timeCategory in ["afternoon","morning"]:
            base=20
        else:
            base=30
        
        if attendees and attendees>1:
            base+=(attendees-1)*15
        else:
            base+=10

    
    elif eventType=="coffee":
        base=5*(attendees if attendees else 2)


    elif eventType=="entertainment":
        base=80
        if dayType=="weekend":
            base+=20
    

    elif eventType=="transport":
        base=20
    else:
        base=15

    return round(base,2)

def calculate_confidence(features):
    if not features:
        return 0.0

    total=len(features)
    known=sum(1 for ef in features if ef.get('event_type')!='other')
    location_known=sum(1 for ef in features if ef.get('has_location'))
    attendees_known=sum(1 for ef in features if ef.get('attendees',0)>0)
    score=(0.4*(known/total)+0.3*(location_known/total)+0.3*(attendees_known/total))
    return min(max(score,0),1)


def predict_spending(parsed_events):
    if not parsed_events:
        return{
            "total_predicted":0,
            "confidence":0,
            "breakdown":{"food":0,"entertainment":0,"transport":0,"other":0}
        }
    breakdown={"food": 0,"entertainment":0,"transport":0,"other":0}
    total=0

    for event in parsed_events:
        cost=estimate_spending(event)
        total+=cost
        etype=event.get('event_type', 'other')
        if etype in ['meal', 'coffee']:
            breakdown['food']+=cost
        elif etype=='entertainment':
            breakdown['entertainment']+=cost
        elif etype=='transport':
            breakdown['transport']+=cost
        else:
            breakdown['other']+=cost

    confidence=calculate_confidence(parsed_events)

    return {
        "total_predicted":round(total,2),
        "confidence":round(confidence,2),
        "breakdown":breakdown
    }
if __name__=="__main__":
    from parser import parse_calendar_events
    test_events=[
        {"title":"Dinner with friends","location":"Earls","start_time":"2024-03-15T19:00:00","attendees":4},
        {"title":"Coffee meeting","location":"Starbucks","start_time":"2024-03-16T10:00:00","attendees":2},
        {"title":"Concert", "location": "Venue", "start_time": "2024-03-16T20:00:00"},
        {"title":"Gym workout", "start_time": "2024-03-17T08:00:00"}
    ]
    features=parse_calendar_events(test_events)
    result=predict_spending(features)
    print("Prediction Result:")
    print(f"Total: ${result['total_predicted']}")
    print(f"Confidence: {result['confidence']}")
    print("Breakdown:")
    for cat,amt in result['breakdown'].items():
        print(f"  {cat}: ${amt}")