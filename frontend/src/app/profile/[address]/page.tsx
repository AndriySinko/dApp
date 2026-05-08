export default function ProfilePage({ params }: { params: { address: string } }) {
  return <div>Profile {params.address}</div>;
}
