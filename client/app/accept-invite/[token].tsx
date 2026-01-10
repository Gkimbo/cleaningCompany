import { useLocalSearchParams } from "expo-router";
import AcceptInvitationScreen from "../../src/components/client/AcceptInvitationScreen";

export default function AcceptInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <AcceptInvitationScreen inviteToken={token} />;
}
