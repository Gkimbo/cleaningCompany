import { useLocalSearchParams } from "expo-router";
import AcceptEmployeeInvitationScreen from "../../src/components/employee/AcceptEmployeeInvitationScreen";

export default function AcceptEmployeeInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <AcceptEmployeeInvitationScreen inviteToken={token} />;
}
