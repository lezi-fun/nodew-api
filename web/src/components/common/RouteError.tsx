export default function RouteError({ title, message }: { title: string; message: string }) {
  return (
    <div className="screen-state error-state">
      <div>
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}
