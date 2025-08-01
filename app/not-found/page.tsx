export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-6xl font-bold text-red-600">404</h1>
            <p className="mt-4 text-xl text-gray-700">Page Not Found</p>
            <p className="mt-2 text-gray-500">The page you are looking for does not exist.</p>
        </div>
    )
}
