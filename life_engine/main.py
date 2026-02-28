from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from parser import parse_calendar_events
from prediction import predict_spending as run_prediction
from element_of_game import generate_challenge
from leaderboard import calculate_leaderboard
app=FastAPI()

class CalendarEvent(BaseModel):
    title:str
    location: Optional[str]=None
    start_time:str
    attendees: Optional[int]=None

class PredictRequest(BaseModel):
    events: List[CalendarEvent]

class PredictResponse(BaseModel):
    predicted_total:float
    confidence:float
    breakdown:dict
    features:List[dict]=None

class ChallengeRequest(BaseModel):
    predicted_total:float
    user_id: Optional[str]='default_user'

class ChallengeResponse(BaseModel):
    challenge_id:str
    target_spending:float
    points:int
    suggested_friends:List[str]
    message:str

class Participant(BaseModel):
    name:str
    spent:float

class LeaderboardRequest(BaseModel):
    participants:List[Participant]
    challenge_target:Optional[float]=None

class LeaderboardEntry(BaseModel):
    name:str
    spent:float
    rank:int
    status:Optional[str]=None

class LeaderboardResponse(BaseModel):
    leaderboard:List[LeaderboardEntry]

@app.get("/")
def read_root():
    return {"message": "working"}

@app.post("/leaderboard",response_model=LeaderboardResponse)
def leaderboard(request:LeaderboardRequest):
    participants_dict=[p.model_dump() for p in request.participants]
    result=calculate_leaderboard(participants_dict,request.challenge_target)
    return {"leaderboard":result}


@app.post("/predict", response_model=PredictResponse)
def predict(request:PredictRequest):
    eventdict=[event.model_dump() for event in request.events]
    features=parse_calendar_events(eventdict)
    result=run_prediction(features)

    return {
        "predicted_total":result["total_predicted"],
        "confidence":result["confidence"],
        "breakdown":result["breakdown"],
        "features":features
    }

@app.post("/challenge", response_model=ChallengeResponse)
def challenge(request:ChallengeRequest):
    mock_user_history={
        "avg_weekly_spending":200,
        "past_success_rate":0.5,
        "friends":["Emma","Liam","Olivia","Noah"]
    }
    game=generate_challenge(request.predicted_total,mock_user_history)
    return game