import { LoginForm } from '@/components/shared/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-xl shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold">UP Media</h1>
          <p className="text-sm text-gray-500 mt-1">Nền tảng Kiểm tra & KPI nội bộ</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
