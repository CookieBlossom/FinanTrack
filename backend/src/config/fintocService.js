const axios = require('axios');
const FINTOC_API_URL = 'https://api.fintoc.com';
const SECRET_KEY = process.env.FINTOC_SECRET_KEY;

export const getAccounts = async (linkId) => {
  const res = await axios.get(`${FINTOC_API_URL}/accounts?link_id=${linkId}`, {
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
    },
  });
  return res.data;
};
