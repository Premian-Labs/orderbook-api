import React from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import Main from './Main'
import Settings from './Settings'
import Error404 from './Error404'
import { Navbar } from './Navbar'
import Account from './Account'
import History from './History'

const HeaderLayout = () => (
	<>
		<header>
			<Navbar />
		</header>
		<Outlet />
	</>
)

const router = createBrowserRouter([
	{
		element: HeaderLayout(),
		errorElement: <Error404 />,
		children: [
			{
				path: '/',
				element: <Navigate to="/home" replace />,
			},
			{
				index: true,
				path: 'home',
				element: <Main />,
			},
			{
				path: 'account',
				element: <Account />,
			},
			{
				path: 'history',
				element: <History />,
			},
			{
				path: 'settings',
				element: <Settings />,
			},
		],
	},
])

const element = document.getElementById('root')
const root = createRoot(element!)

root.render(<RouterProvider router={router} />)
