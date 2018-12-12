# Test Specification

How to use this doc: 

cmd+f the following,

REDALERT => vulnerabilities in contract that need to be fixed.
TODO => things to, uhh... do.
TESTME => items which still need to be unit tested.
PUNT => items which will be completed on next release.

## Happy Case Tests

### hubAuthorizedUpdate
Expect
1. Fails if `msg.sender` is not hub
    - with TODO
2. Fails if channel status is not `Open`.
    - with "channel must be open"
3. Fails if timeout is not 0 and `timeout <= now`
    - with "the timeout must be zero or not have passed"
4. Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
5. Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
6. Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
7. Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
8. Fails if sender is hub and the total pending wei deposits for both sides of the channel are greater than the hub's reserve wei
    - with "insufficient reserve wei for deposits"
9. Fails if sender is hub and the total pending token deposits for both sides of the channel are greater than the hub's reserve tokens
    - with "insufficient reserve tokens for deposits"
10. Fails if sender is not hub and hub wei deposit is greater than hub reserve wei
    - with "insufficient reserve wei for deposits"
11. Fails if sender is not hub and hub token deposit is greater than hub reserve token
    - with "insufficient reserve tokens for deposits"
12. Fails if the current total channel wei + both deposits is less than the final balances + both withdrawals
    - with "insufficient wei"
13. Fails if the current total channel tokens + both deposits is less than the final balances + both withdrawals
    - with "insufficient token"
14. Fails if user is hub
    - with "user can not be hub"
15. Fails if user is channel manager
    - with "user can not be channel manager"
16. Fails if address in signature is not the address of channel manager
    - fails with either "hub signature invalid" or "user signature invalid"
17. Fails if user or recipient is not correct in state
    - fails with either "hub signature invalid" or "user signature invalid"
18. Fails if weiBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
19. Fails if tokenBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
20. Fails if pendingWeiUpdates are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
21. Fails if pendingTokenUpdates is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
22. Fails if txCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
23. Fails if threadRoot is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be empty for this release! TODO verify that this is validated on client/hub 
24. Fails if threadCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be zero for this release! TODO verify that this is validated on client/hub
25. Fails if timeout is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
26. Fails if user is not the signer of sigUser
    - with "user signature invalid"
27. totalChannelWei is increased by depposits and decreased by withdrawals as expected in success case
28. same as above for tokens
29. verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
30. same for tokens
31. verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
32. verify that channelBalances[0] stays the same in the case that withdraws >= deposits
33. same as above for channelBalances[1] in case where deposits are greater than withdrawals
34. same as above for channelBalances[1] in case where withdrawals >= deposits
35. Fails if token transfer for withdrawal fails
    - with "user token withdrawal transfer failed"
    - TODO how could this fail?

### userAuthorizedUpdate
Expect
1. Fails if `msg.value` is not equal to `pendingWeiUpdates[2]`
    - with "msg.value is not equal to pending user deposit"
2. Fails if channel status is not `Open`.
    - with "channel must be open"
3. Fails if timeout is not 0 and `timeout <= now`
    - with "the timeout must be zero or not have passed"
4. Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
5. Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
6. Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
7. Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
8. Fails if sender is hub and the total pending wei deposits for both sides of the channel are greater than the hub's reserve wei
    - with "insufficient reserve wei for deposits"
9. Fails if sender is hub and the total pending token deposits for both sides of the channel are greater than the hub's reserve tokens
    - with "insufficient reserve tokens for deposits"
10. Fails if sender is not hub and hub wei deposit is greater than hub reserve wei
    - with "insufficient reserve wei for deposits"
11. Fails if sender is not hub and hub token deposit is greater than hub reserve token
    - with "insufficient reserve tokens for deposits"
12. Fails if the current total channel wei + both deposits is less than the final balances + both withdrawals
    - with "insufficient wei"
13. Fails if the current total channel tokens + both deposits is less than the final balances + both withdrawals
    - with "insufficient token"
14. Fails if `msg.sender` is hub
    - with "user can not be hub"
15. Fails if `msg.sender` is channel manager
    - with "user can not be channel manager"
16. Fails if address in signature is not the address of channel manager
    - fails with either "hub signature invalid" or "user signature invalid"
17. Fails if user or recipient is not correct in state
    - fails with either "hub signature invalid" or "user signature invalid"
18. Fails if weiBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
19. Fails if tokenBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
20. Fails if pendingWeiUpdates are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
21. Fails if pendingTokenUpdates is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
22. Fails if txCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
23. Fails if threadRoot is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be empty for this release! TODO verify that this is validated on client/hub 
24. Fails if threadCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be zero for this release! TODO verify that this is validated on client/hub
25. Fails if timeout is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
26. Fails if hub is not the signer of sigHub
    - with "hub signature invalid"
27. Fails if user token transferFrom fails (token transfer not approved)
    - with "user token deposit failed"
28. verify that totalChannelWei is increased by depposits and decreased by withdrawals as expected in success case
29. same for tokens
30. verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
31.  same for tokens
32. verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
33. verify that channelBalances[0] stays the same in the case that withdraws >= deposits
34. same as above for channelBalances[1] in case where deposits are greater than withdrawals
35. same as above for channelBalances[1] in case where withdrawals >= deposits
36. Fails if token transfer for withdrawal fails
    - with "user token withdrawal transfer failed"
    - TODO how could this fail?

## Unilateral Channel Tests

## Unilateral Thread Tests

PUNT


## ---- Arjun Notes ----

Internal function fail conditions:

#### _verifyAuthorizedUpdate

Test requires
- Fails if channel status is not `Open`.
    - with "channel must be open"
- Fails if timeout is not 0 and `timeout <= now`
    - with "the timeout must be zero or not have passed"
- Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
- Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
- Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
- Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
- Fails if sender is hub and the total pending wei deposits for both sides of the channel are greater than the hub's reserve wei
    - with "insufficient reserve wei for deposits"
- Fails if sender is hub and the total pending token deposits for both sides of the channel are greater than the hub's reserve tokens
    - with "insufficient reserve tokens for deposits"
- Fails if sender is not hub and hub wei deposit is greater than hub reserve wei
    - with "insufficient reserve wei for deposits"
- Fails if sender is not hub and hub token deposit is greater than hub reserve token
    - with "insufficient reserve tokens for deposits"
- Fails if the current total channel wei + both deposits is less than the final balances + both withdrawals
    - with "insufficient wei"
- Fails if the current total channel tokens + both deposits is less than the final balances + both withdrawals
    - with "insufficient token"

Test inputs
- In what ways can you break `channel`?
    - Can you instantiate the "wrong" channel? I.e. can Alice call `userAuthorizedUpdate` for Bob's channel?
        - No because `userAuthorizedUpdate` instantiates channel with msg.sender
        - Hub can do this, but this would get caught in the sig verification.
    - Can the hub call `hubAuthorizedUpdate` and instantiate a channel with itself?
        - Yes. There doesn't appear to be anything stopping this behavior?
        - What happens here?
            - Hub's self-channel status could be open -> this is ok
            - Hub's passed in txCount could be fake or misrepresent state -> this is bad insofar as hub can easily spoof a state with itself!
            - Hub's self-channel total balances (including threads) could be greater than it's available balance in the channel -> this is ok
        - Edit: this gets checked in verifySig
    - Can the hub call `hubAuthorizedUpdate` and instantiate a channel with the contract?
        - Edit: gets checked in verifySig
- In what ways can you break `txCount`?
    - Can txCount in the calling function be different than the passed in input? i.e. can the state input data be mismatched with count?
        - It can. You submit txCount along with all variables to `hubAuthorizedUpdate` or `userAuthorizedUpdate` which call this function immediately.
        - This is not an issue because it fails in sig verification
- In what ways can you break `weiBalances`?
    - You can pass in a random weiBalance not associated with state
        - Would fail sig verification. 
- In what ways can you break `tokenBalances`?
    - You can pass in random tokenBalace not associated with state
        - Would fail sig verification.
    - Token contract is specified in constructor, no vulns there.
- In what ways can you break pending wei/token updates?
    - Where do we check to make sure that deposit == msg.value?
        - Only need to check this for user update -> we require here that msg.value == user deposit.
        - What happens if user deposits into hub side? -> I guess they're just donating to hub? TODO verify this
    - What happens if user gives false values for deposit/withdraw?
        - Gives nonzero hub deposit -> hub would have had to sign so it's ok
        - This gets caught in sig verification.
- In what ways can you break `timeout`?
    - Timeout can be in 3 states: 0, less than now or greater than now.
    - Can we pass in timeout from other channel or falsify?
        - Gets caught in sig verification.
- In what ways can you break `isHub`?
    - Set when calling user or hub authorized update.
    - `hubAuthorizedUpdate` can only be called by Hub and sets `isHub` to true.
    - `userAuthorizedUpdate` can be called by anyone but uses msg.sender to instantiate channel. Hub can instantiate channel with self or contract here and enter a state where isHub is false even when hub calls.
        - edit: This gets checked in verifySig TESTME

#### _applyPendingUpdates

Test requires
- N/A

Test inputs
- Inputs are verified by sig verification previously

Test states
- Need to verify all code paths here
- TESTME verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
- TESTME verify that channelBalances[0] stays the same in the case that withdraw is >= deposit
- TESTME same as above for channelBalances[1] in case where deposits are greater than withdrawals
- TESTME same as above for channelBalances[1] in teh case where withdrawals >= deposits

#### _revertPendingUpdates
#### _updateChannelBalances

Test requires
- N/A

Test inputs
- Inputs are verified by sig verification previously

Test states
- TESTME verify that totalChannelWei is increased by depposits and decreased by withdrawals as expected in success case
- TESTME same for tokens
- TESTME verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
- TESTME same for tokens

#### _verifySig

Test requires
- Fails if user is hub
    - with "user can not be hub"
- Fails if user is channel manager
    - with "user can not be channel manager"
- Fails if address in signature is not the address of channel manager
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if user or recipient is not correct in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if weiBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if tokenBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if pendingWeiUpdates are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if pendingTokenUpdates is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if txCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if threadRoot is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be empty for this release! TODO verify that this is validated on client/hub 
- Fails if threadCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be zero for this release! TODO verify that this is validated on client/hub
- Fails if timeout is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if hub is not the signer of sigHub
    - with "hub signature invalid"
- Fails if user is not the signer of sigUser
    - with "user signature invalid"

Test inputs
- In what ways can we break `user`?
    - If it's not the expected input, gets caught in sig verification
- Same for `weiBalances`, `tokenBalances`, `pendingWeiUpdates`, `pendingTokenUpdates`, `txCount`, `threadRoot`, `threadCount`, `timeout`.
    - Signatures make this an offchain problem, so client _needs_ to conform to the "Dont Sign Dumb Shit" heuristic.
- Is there any way to force an incorrect sigHub/sigUser to deny this verification?
    - Client again should be checking for this to stop indisputable states.
- In what ways can we break `checks` boolean?
    - Only possible if either hub can call `userAuthorizedUpdate` or user can call `hubAuthorizedUpdate`
        - user can't cause hub update is onlyHub
        - hub can't cause user update uses msg.sender for user and verifySig requires that user != hub. TESTME

#### _verifyThread

PUNT

#### _isContained

PUNT