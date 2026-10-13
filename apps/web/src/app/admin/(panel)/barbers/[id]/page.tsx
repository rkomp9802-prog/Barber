import { BarberDetail } from '@/components/admin/barbers/BarberDetail'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminBarberRoute({ params }: Props) {
  const { id } = await params
  return <BarberDetail key={id} id={id} />
}
