def calculate_leaderboard(participants,challenge_target=None):
    if not participants:
        return []

        
    sorted_participants=sorted(participants,key=lambda x:x['spent'])
    ranked=[]
    current_rank=1
    i=0
    while i<len(sorted_participants):
        current_spent=sorted_participants[i]['spent']
        tie_count=1
        while i+tie_count<len(sorted_participants) and sorted_participants[i+tie_count]['spent']==current_spent:
            tie_count+=1
        for j in range(tie_count):
            participant=sorted_participants[i+j].copy()
            participant['rank']=current_rank
            if challenge_target is not None:
                participant['status']='under' if participant['spent']<=challenge_target else 'over'
            else:
                participant['status']=None
            ranked.append(participant)

        i+=tie_count
        current_rank+=tie_count
    return ranked

if __name__=="__main__":
    test_participants = [
        {"name":"Alice","spent":120.50},
        {"name":"Bob","spent":95.00},
        {"name":"Charlie","spent":150.75},
        {"name":"Diana","spent":95.00},
        {"name":"Eve","spent": 200.00}
    ]
    target=130.00


    print("Leaderboard (no target):")
    lb=calculate_leaderboard(test_participants)
    for entry in lb:
        print(f"Rank {entry['rank']}: {entry['name']} - ${entry['spent']}")


    print("\nLeaderboard (with target ${}):".format(target))
    lb_with_target=calculate_leaderboard(test_participants, target)
    for entry in lb_with_target:
        print(f"Rank {entry['rank']}: {entry['name']} - ${entry['spent']} ({entry['status']})")