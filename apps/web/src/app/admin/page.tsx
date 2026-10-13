import { redirect } from 'next/navigation'

import { ADMIN_HOME_PATH } from '@/lib/admin/nextPath'

export default function AdminIndexPage() {
  redirect(ADMIN_HOME_PATH)
}
