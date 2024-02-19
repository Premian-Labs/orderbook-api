import React, {useEffect, useMemo} from 'react'
import './styles/Main.css'
import './styles/Vaults.css'
import logo from './logo.svg'
import { getSpotPrice, getVaults } from './utils/apiGetters'
import {Market, QuoteResponse, VaultsTable} from './types'
import _ from 'lodash'
import {Column, useSortBy, useTable} from "react-table";

const COLUMNS = [
	{
		Header: 'Vault',
		accessor: 'vault' as const,
	},
	{
		Header: 'Strike',
		accessor: 'strike' as const,
	},
	{
		Header: 'Expiration',
		accessor: 'expiration' as const,
	},
	{
		Header: 'Direction',
		accessor: 'direction' as const,
	},
	{
		Header: 'Quote',
		accessor: 'quote' as const,
	},
]

function Vaults() {
	const [marketSelector, setMarketSelector] = React.useState('WETH' as Market)
	const [vaults, setVaults] = React.useState([] as QuoteResponse[])
	const [vaultsRows, setVaultsRows] = React.useState([] as VaultsTable[])
	const [expirations, setExpirations] = React.useState([] as string[])
	const [activeExpiration, setActiveExpiration] = React.useState('')

	const columns = useMemo<Column<VaultsTable>[]>(() => COLUMNS, [])
	const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
		{ columns, data: vaultsRows, autoResetSortBy: false },
		useSortBy,
	)

	useEffect(() => {
		getSpotPrice()
			.then((spotPrice) => getVaults(marketSelector, spotPrice[marketSelector]))
			.then((vaults) => {
				setVaults(vaults)
				const expirations = _.chain(vaults)
					.map((x) => x.market.expiration)
					.uniq()
					.value()
				setExpirations(expirations)
				if (!activeExpiration) setActiveExpiration(expirations[0])
			})
			.catch(console.error)
	}, [marketSelector])

	useEffect(() => {
		setVaultsRows(
			vaults
				.filter(x => x.market.expiration === activeExpiration)
				.map(x => ({
					vault: x.market.vault,
					direction: x.market.direction,
					strike: x.market.strike,
					expiration: x.market.expiration,
					quote: Number(x.quote.toFixed(2))
				}))
		)
	}, [vaults, marketSelector, activeExpiration])

	return (
		<div className="app">
			<div className="app-container">
				<p hidden={vaults.length === 0}>Premia Underwriter Vaults Quotes</p>
				<div className="selector">
					<button
						className={marketSelector === 'WETH' ? 'selector-btn-active' : 'selector-btn'}
						onClick={() => setMarketSelector('WETH')}
					>
						ETH
					</button>
					<button
						className={marketSelector === 'WBTC' ? 'selector-btn-active' : 'selector-btn'}
						onClick={() => setMarketSelector('WBTC')}
					>
						BTC
					</button>
					<button
						className={marketSelector === 'ARB' ? 'selector-btn-active' : 'selector-btn'}
						onClick={() => setMarketSelector('ARB')}
					>
						ARB
					</button>
				</div>
				<img hidden={vaults.length > 0} src={logo} className="app-logo" alt="logo"/>
				<p hidden={vaults.length > 0}>Loading Vaults data...</p>
				<div style={{display: vaults.length > 0 ? 'block' : 'none'}} className="positions-container">
					<div className="expirations-container">
						{expirations.map((expiration) => {
							return (
								<button
									onClick={() => setActiveExpiration(expiration)}
									className={activeExpiration === expiration ? 'selector-btn-active' : 'selector-btn'}
									key={expiration}
								>
									{expiration}
								</button>
							)
						})}
					</div>
					<div className="table-container">
						<table style={{display: vaults.length > 0 ? 'table' : 'none'}} {...getTableProps()}>
							<thead>
							{headerGroups.map((headerGroup) => (
								<tr {...headerGroup.getHeaderGroupProps()}>
									{headerGroup.headers.map((column) => (
										<th
											className={column.isSorted ? 'sorted' : ''}
											{...column.getHeaderProps(column.getSortByToggleProps())}
										>
											{column.render('Header')}
										</th>
									))}
								</tr>
							))}
							</thead>
							<tbody {...getTableBodyProps()}>
							{rows.map((row) => {
								prepareRow(row)
								return (
									<tr {...row.getRowProps()}>
										{row.cells.map((cell) => {
											return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
										})}
									</tr>
								)
							})}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	)
}

export default Vaults
