#I added it optional. Reason: one of the criteria was to create a tool that solves existing problem and use the element of game to make it more engaging"
#we can delete it (but i think we should not :))(if we decide to ignore it, I will mark code in other files as "GI" which will be game ignore mark (easy to delte it))

import random
import uuid

def generate_challenge(predict_total,user_history=None):
    if user_history is None:
        user_history={}

    challenge_id=f"challenge_{uuid.uuid4().hex[:8]}"
    avgWeeklySpending=user_history.get('avg_weekly_spending',200)
    pastSuccessRate=user_history.get('past_success_rate',0.5)
    friendList=user_history.get('friends',['Alex', 'Jordan', 'Taylor'])

    if pastSuccessRate>0.7:
        savFactor=0.75
    elif pastSuccessRate>0.4:
        savFactor=0.85
    else:
        savFactor=0.9
    
    blended=0.7*predict_total+0.3*avgWeeklySpending
    goal=round(blended*savFactor,2)

    basePoints=500
    difficulty_bonus=int((1-savFactor)*1000)
    points=basePoints+difficulty_bonus

    num_suggestions=min(3,len(friendList))
    suggested=random.sample(friendList,num_suggestions) if friendList else []

    message=f"Keep your spending UNDER ${goal} this weekend and earn {points} points!"

    return{
        "challenge_id":challenge_id,
        "target_spending":goal,
        "points":points,
        "suggested_friends":suggested,
        "message":message
    }

if __name__=="__main__":
    mock_history={
        "avg_weekly_spending":250,
        "past_success_rate":0.6,
        "friends":["Emma","Liam","Olivia","Noah"]
    }
    predicted=185.0
    challenge=generate_challenge(predicted,mock_history)
    print("Generated Challenge:")
    print(f"Challenge ID: {challenge['challenge_id']}")
    print(f"Target Spending: ${challenge['target_spending']}")
    print(f"Points: {challenge['points']}")
    print(f"Suggested Friends: {', '.join(challenge['suggested_friends'])}")
    print(f"Message: {challenge['message']}")
