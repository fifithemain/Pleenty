import PaymentSuccessClient from './PaymentSuccessClient';

export default function PaymentSuccess({ searchParams }: { searchParams: { order?: string } }) {
  return <PaymentSuccessClient order={searchParams.order || ''} />;
}
