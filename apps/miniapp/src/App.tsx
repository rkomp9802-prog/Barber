import { useState } from 'react'

import { api } from './client'
import { useRequest } from './hooks/useRequest'
import { BookingFlow, type Catalog } from './screens/BookingFlow'
import { HomeScreen } from './screens/HomeScreen'
import { MyBookings } from './screens/MyBookings'

type View = 'home' | 'book' | 'my'

async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const [services, barbers] = await Promise.all([api.getServices(signal), api.getBarbers(signal)])
  return { services, barbers }
}

export function App() {
  const [view, setView] = useState<View>('home')
  // Каталог грузим сразу: пока пользователь на главном экране, услуги уже загрузятся.
  const catalog = useRequest('catalog', loadCatalog)
  // Новый key — новый сценарий записи при каждом входе.
  const [flowKey, setFlowKey] = useState(0)

  const startBooking = (): void => {
    setFlowKey(value => value + 1)
    setView('book')
  }
  const goHome = (): void => setView('home')
  const openMyBookings = (): void => setView('my')

  if (view === 'book') {
    return <BookingFlow key={flowKey} catalog={catalog} onExit={goHome} onMyBookings={openMyBookings} />
  }
  if (view === 'my') return <MyBookings onBack={goHome} onBook={startBooking} />
  return <HomeScreen onBook={startBooking} onMyBookings={openMyBookings} />
}
