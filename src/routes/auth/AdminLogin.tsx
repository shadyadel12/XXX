import { RoleLogin } from './CoachLogin';

/** Admin sign in — same email+password flow, expects role='admin'. */
export default function AdminLogin() {
  return <RoleLogin expectedRole="admin" title="Admin sign in" home="/admin/coaches" />;
}
