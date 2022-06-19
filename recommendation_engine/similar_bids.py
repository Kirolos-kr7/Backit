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

# top_4_similar_bids that will appear on bid page


bid_bid_sim_matrix = pd.DataFrame(cosine_similarity(bidder_bid_matrix.T))


bid_bid_sim_matrix.columns = bidder_bid_matrix.T.index
bid_bid_sim_matrix['bidID'] = bidder_bid_matrix.T.index
bid_bid_sim_matrix = bid_bid_sim_matrix.set_index('bidID')

# similar_bids on bid page
bid_id = sys.argv[2]
top_4_similar_bids = list(
    bid_bid_sim_matrix
    .loc[bid_id]
    .sort_values(ascending=False)
    .iloc[:4]
    .index
)

result = ''
for bid in top_4_similar_bids:
    if(bid != sys.argv[2]):
        result += (bid + ' ')

if(not result):
    print('N/F')
else:
    print(result)

sys.stdout.flush()
