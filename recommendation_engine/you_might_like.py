import json
import sys
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

df = pd.DataFrame(list(json.loads(sys.argv[1])))


dfcleared = df.dropna(subset=['bidderID'])


bidder_bid_matrix = dfcleared.pivot_table(
    index='bidderID', columns='bidID', values='viewed', aggfunc='sum')


dfcleared['bidderID'].nunique()
dfcleared['bidID'].nunique()


# We apply fillna() function to convert Nan to 0


bidder_bid_matrix = bidder_bid_matrix.fillna(0)


# Bidder based Collaborative Filtering


bidder_to_bidder_sim_matrix = pd.DataFrame(
    cosine_similarity(bidder_bid_matrix))


# Replaced defualt incremental numbers with BidderIDs


bidder_to_bidder_sim_matrix.columns = bidder_bid_matrix.index
bidder_to_bidder_sim_matrix['bidderID'] = bidder_bid_matrix.index
bidder_to_bidder_sim_matrix = bidder_to_bidder_sim_matrix.set_index('bidderID')

# you might like on main page
bidder_id = sys.argv[2]


bidder_to_bidder_sim_matrix.loc[bidder_id].sort_values(ascending=False)


top_similar_bidders = list(
    bidder_to_bidder_sim_matrix
    .loc[bidder_id]
    .sort_values(ascending=False)
    .iloc[1:]
    .index
)


items_viewed_bysimilar_bidder = list()
for i in top_similar_bidders:
    items_viewed_bysimilar_bidder.extend(
        bidder_bid_matrix.loc[i].iloc[bidder_bid_matrix.loc[i].to_numpy().nonzero()].index)

items_viewed_bysimilar_bidder = list(
    dict.fromkeys(items_viewed_bysimilar_bidder))
items_viewed_bysimilar_bidder


items_viewed_by_A = list(
    bidder_bid_matrix.loc[bidder_id].iloc[bidder_bid_matrix.loc[bidder_id].to_numpy().nonzero()].index)


items_to_recommend_User_A = [
    bidid for bidid in items_viewed_bysimilar_bidder if bidid not in items_viewed_by_A]


result = ''
for bid in items_to_recommend_User_A:
    result += (bid + ' ')


if(not result):
    print('N/F')
    sys.stdout.flush()
else:
    print(result)
    sys.stdout.flush()
