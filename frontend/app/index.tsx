import { Redirect } from 'expo-router';

export default function Index() {
  // כרגע אנחנו מגדירים שמשתמש לא מחובר כברירת מחדל
  // בשלב הבא, נחבר את זה ל-Backend כדי לבדוק אם הוא באמת מחובר
  const isLoggedIn = false;

  if (!isLoggedIn) {
    // אם לא מחובר -> זרוק אותו למסך התחברות
    return <Redirect href="/login" />;
  }

  // אם מחובר -> הכנס אותו ישר לאפליקציה (למפה)
  return <Redirect href="/(tabs)" />;
}