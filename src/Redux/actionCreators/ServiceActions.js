import { Auth, API } from "aws-amplify";

import { APIEndpoints, APIPaths } from "../../config/APIEndpoints";
import { loaderActions } from "./";

import { LoaderContent } from "../../utility/constants/LoaderContent";
import { initializeAPIOptions } from "../../utility/API";

export const UPDATE_SERVICE_LIST = "SET_SERVICE_LIST";
export const UPDATE_PAGINATION_DETAILS = "SET_PAGINATION_DETAILS";
export const UPDATE_SERVICE_EXECUTION_RESPONSE = "UPDATE_SERVICE_EXECUTION_RESPONSE";
export const RESET_SERVICE_EXECUTION = "RESET_SERVICE_EXECUTION";
export const UPDATE_SPEC_DETAILS = "UPDATE_SPEC_DETAILS";
export const UPDATE_FILTER_DATA = "UPDATE_FILTER_DATA";
export const UPDATE_ACTIVE_FILTER_ITEM = "UPDATE_ACTIVE_FILTER_ITEM";
export const RESET_FILTER_ITEM = "RESET_FILTER_ITEM";
export const UPDATE_FEEDBACK = "UPDATE_FEEDBACK";

export const updateActiveFilterItem = activeFilterItem => dispatch => {
  dispatch({ type: UPDATE_ACTIVE_FILTER_ITEM, payload: { ...activeFilterItem } });
};

export const resetFilterItem = dispatch => {
  dispatch({ type: RESET_FILTER_ITEM });
};

export const fetchServiceSuccess = res => dispatch => {
  dispatch({
    type: UPDATE_PAGINATION_DETAILS,
    payload: {
      total_count: res.data.total_count,
    },
  });
  dispatch({ type: UPDATE_SERVICE_LIST, payload: res.data.result });
  dispatch(loaderActions.stopAIServiceListLoader);
};

export const fetchService = (pagination, filters = []) => dispatch => {
  dispatch(loaderActions.startAIServiceListLoader);
  const url = new URL(`${APIEndpoints.CONTRACT.endpoint}/service`);
  return fetch(url, {
    method: "POST",
    body: JSON.stringify({ ...pagination, filters }),
  })
    .then(res => res.json())
    .then(res => dispatch(fetchServiceSuccess(res)))
    .catch(() => dispatch(loaderActions.stopAIServiceListLoader));
};

export const updatePagination = pagination => dispatch => {
  dispatch({
    type: UPDATE_PAGINATION_DETAILS,
    payload: pagination,
  });
};

export const fetchFilterData = attribute => dispatch => {
  const url = `${APIEndpoints.CONTRACT.endpoint}${APIPaths.FILTER_DATA}${attribute}`;
  return fetch(url)
    .then(res => res.json())
    .then(res => {
      dispatch({ type: UPDATE_FILTER_DATA, payload: { [attribute]: res.data.values } });
    });
};

export const handleFilterChange = ({ pagination, filterObj, currentActiveFilterData }) => dispatch => {
  dispatch(loaderActions.startAIServiceListLoader);
  Promise.all([
    dispatch(updatePagination(pagination)),
    dispatch(fetchService(pagination, filterObj)),
    dispatch(updateActiveFilterItem(currentActiveFilterData)),
  ])
    .then(() => dispatch(loaderActions.stopAIServiceListLoader))
    .catch(() => dispatch(loaderActions.stopAIServiceListLoader));
};

export const resetFilter = ({ pagination }) => dispatch => {
  dispatch(loaderActions.startAIServiceListLoader);
  Promise.all([dispatch(updatePagination(pagination)), dispatch(fetchService(pagination)), dispatch(resetFilterItem)])
    .then(() => dispatch(loaderActions.stopAIServiceListLoader))
    .catch(() => dispatch(loaderActions.stopAIServiceListLoader));
};

const fetchFeedbackAPI = (email, orgId, serviceId, token) => {
  const apiName = APIEndpoints.USER.name;
  const path = `${APIPaths.FEEDBACK}?org_id=${orgId}&service_id=${serviceId}`;
  const apiOptions = initializeAPIOptions(token);
  return API.get(apiName, path, apiOptions);
};

const fetchAuthTokenAPI = (serviceId, groupId, publicKey, orgId, userId, token) => {
  let url = new URL(`${APIEndpoints.SIGNER_SERVICE.endpoint}${APIPaths.FREE_CALL_TOKEN}`);
  const queryParams = {
    service_id: serviceId,
    group_id: groupId,
    public_key: publicKey,
    org_id: orgId,
    user_id: userId,
  };
  Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
  // TODO replace fetch with API
  return fetch(url, { headers: { Authorization: token } });
};

export const downloadAuthToken = (serviceid, groupid, publickey, orgid) => async dispatch => {
  dispatch(loaderActions.startAppLoader(LoaderContent.CHECK_PUBLIC_KEY));
  let downloadURL = "";
  const currentUser = await Auth.currentAuthenticatedUser({ bypassCache: true });
  const userid = currentUser.attributes.email;

  const response = await fetchAuthTokenAPI(
    serviceid,
    groupid,
    publickey,
    orgid,
    userid,
    currentUser.signInUserSession.idToken.jwtToken
  );
  if (response.ok) {
    const myBlob = await response.blob();
    downloadURL = window.URL.createObjectURL(myBlob);
    dispatch(loaderActions.stopAppLoader);
    return downloadURL;
  } else {
    dispatch(loaderActions.stopAppLoader);
    return downloadURL;
  }
};

//Username review
export const fetchFeedback = (orgId, serviceId) => async () => {
  const currentUser = await Auth.currentAuthenticatedUser({ bypassCache: true });
  return fetchFeedbackAPI(currentUser.email, orgId, serviceId, currentUser.signInUserSession.idToken.jwtToken);
};

const submitFeedbackAPI = (feedbackObj, token) => {
  const apiName = APIEndpoints.USER.name;
  const path = `${APIPaths.FEEDBACK}`;
  const apiOptions = initializeAPIOptions(token, feedbackObj);
  return API.post(apiName, path, apiOptions);
};

export const submitFeedback = (orgId, serviceId, feedback) => async () => {
  const currentUser = await Auth.currentAuthenticatedUser({ bypassCache: true });
  const feedbackObj = {
    feedback: {
      org_id: orgId,
      service_id: serviceId,
      user_rating: parseFloat(feedback.rating).toFixed(1),
      comment: feedback.comment,
    },
  };
  return submitFeedbackAPI(feedbackObj, currentUser.signInUserSession.idToken.jwtToken);
};
