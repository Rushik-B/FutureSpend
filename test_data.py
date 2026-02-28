# Case 1: minimal plans, mostly relaxing at home
quiet_weekend=[
    {
        "title":"Grocery shopping",
        "location":"Superstore",
        "start_time":"2024-03-16T10:00:00",
        "attendees":1
    },
    {
        "title":"Coffee with neighbor",
        "location":"Tim Hortons",
        "start_time":"2024-03-16T14:00:00",
        "attendees":2
    },
    {
        "title":"Movie night at home",
        "location":"",
        "start_time":"2024-03-16T20:00:00",
        "attendees":2
    },
    {
        "title":"Sunday brunch",
        "location":"Local diner",
        "start_time":"2024-03-17T11:00:00",
        "attendees":3
    }
]

# Case 2: multiple social events + dining out + entertainment
busy_social_weekend=[
    {
        "title":"Friday team dinner",
        "location":"Earls Restaurant",
        "start_time":"2024-03-15T19:00:00",
        "attendees":6
    },
    {
        "title":"Saturday concert",
        "location":"Rogers Arena",
        "start_time":"2024-03-16T20:00:00",
        "attendees":2
    },
    {
        "title":"Pre-concert drinks",
        "location":"The Pint",
        "start_time":"2024-03-16T17:30:00",
        "attendees":4
    },
    {
        "title":"Sunday recovery brunch",
        "location":"Cactus Club",
        "start_time":"2024-03-17T11:30:00",
        "attendees":3
    },
    {
        "title":"Uber to concert",
        "location":"",
        "start_time":"2024-03-16T19:45:00",
        "attendees":2
    }
]

# Case 3: mostly work events + some meals near office
work_heavy_week=[
    {
        "title":"Team meeting",
        "location":"Conference Room A",
        "start_time":"2024-03-11T09:30:00",
        "attendees":8
    },
    {
        "title":"Lunch with client",
        "location":"Steakhouse",
        "start_time":"2024-03-11T12:30:00",
        "attendees":3
    },
    {
        "title":"Coffee run",
        "location":"Starbucks",
        "start_time":"2024-03-11T15:00:00",
        "attendees":1
    },
    {
        "title":"Project deadline",
        "location":"",
        "start_time":"2024-03-12T17:00:00",
        "attendees":1
    },
    {
        "title":"Team lunch",
        "location":"Food court",
        "start_time":"2024-03-12T12:00:00",
        "attendees":5
    },
    {
        "title":"Taxi to airport",
        "location":"",
        "start_time":"2024-03-13T06:30:00",
        "attendees":1
    },
    {
        "title":"Flight to Toronto",
        "location":"YYZ",
        "start_time":"2024-03-13T08:45:00",
        "attendees":1
    },
    {
        "title":"Dinner with team",
        "location":"Restaurant",
        "start_time":"2024-03-13T19:00:00",
        "attendees":4
    }
]


all_scenarios={
    "quiet_weekend":quiet_weekend,
    "busy_social_weekend":busy_social_weekend,
    "work_heavy_week":work_heavy_week
}


def print_curl_command(scenario_name,events):
    import json
    payload=json.dumps({"events":events})
    print(f"\n# {scenario_name}")
    print(f"curl.exe -X POST http://127.0.0.1:8000/predict -H \"Content-Type: application/json\" -d '{payload}'")


if __name__=="__main__":
    print("Test Data Scenarios:\n")
    for name,events in all_scenarios.items():
        print(f"{name}: {len(events)} events")
    print("\nTo test each scenario, run the following curl commands:")
    for name,events in all_scenarios.items():
        print_curl_command(name,events)