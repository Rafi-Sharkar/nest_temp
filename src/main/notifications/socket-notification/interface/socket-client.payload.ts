export type PayloadForSocketClient = {
  sub: string;
  email: string;
  userUpdates: boolean;
  userRegistration: boolean;
  payment: boolean;
  message: boolean;
};
