import React, { createContext } from "react";

const UserContext = createContext({
  currentUser: { token: null, id: null },
});

export { UserContext };
