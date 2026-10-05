import { layers, namedFlavor } from '@protomaps/basemaps';
import * as maplibregl from 'maplibre-gl';
import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Protocol } from 'pmtiles';
import mapLibreStyles from 'maplibre-gl/dist/maplibre-gl.css?inline';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import pinSvg from './assets/pin.svg?raw';

const pmtilesProtocol = new Protocol();
maplibregl.setWorkerUrl(mapLibreWorkerUrl);
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

const MAP_BOUNDS: maplibregl.LngLatBoundsLike = [
	[-43.235798, -22.982222],
	[-43.231003, -22.9773],
];

@customElement('puc-map')
export class PucMap extends LitElement {
	static styles = [
		unsafeCSS(mapLibreStyles),
		css`
		:host {
			width: 100%;
			height: 100dvh;
			min-height: 320px;
			box-sizing: border-box;
			display: grid;
			place-items: center;
			padding: 24px;
			background: #eef2f6;
			--puc-map-size: min(78vw, 78vh, 760px);
		}

		.map-frame {
			position: relative;
			width: var(--puc-map-size);
			height: var(--puc-map-size);
		}

		#map {
			width: 100%;
			height: 100%;
			border-radius: 16px;
			box-shadow: 0 16px 48px rgb(27 39 51 / 18%);
		}
		.pin svg{
			stroke:#000000;
			fill:#FF0000;
		}

		.search {
			position: absolute;
			top: 16px;
			left: 16px;
			z-index: 2;
			display: flex;
			align-items: center;
			width: 48px;
			height: 48px;
			max-width: calc(100% - 72px);
			overflow: hidden;
			border-radius: 24px;
			background: white;
			color: #243447;
			box-shadow: 0 3px 14px rgb(27 39 51 / 18%);
			transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
		}

		.search.open { width: 320px; }
		.search:focus-within { outline: 2px solid #507c9b; outline-offset: 3px; }

		.search-button {
			flex: 0 0 48px;
			width: 48px;
			height: 48px;
			display: grid;
			place-items: center;
			padding: 0;
			border: 0;
			border-radius: 50%;
			background: transparent;
			color: inherit;
			cursor: pointer;
		}

		.search-button:hover { background: #f0f4f7; }
		.search-button:focus-visible { outline: 0; }
		.search-button svg { width: 21px; height: 21px; }

		.search-input {
			width: 100%;
			min-width: 0;
			padding: 0 16px 0 2px;
			border: 0;
			outline: 0;
			background: transparent;
			color: inherit;
			font: 16px/1.4 system-ui, sans-serif;
			opacity: 0;
			visibility: hidden;
			transition: opacity 180ms ease;
		}

		.search.open .search-input { opacity: 1; visibility: visible; }
		.search-input::placeholder { color: #687787; }

		@media (prefers-reduced-motion: reduce) {
			.search, .search-input { transition: none; }
		}
	`,
	];

	private map?: maplibregl.Map;

	@state()
	private searchOpen = false;

	connectedCallback() {
		super.connectedCallback();
		this.ownerDocument.addEventListener('pointerdown', this.handleOutsidePointer, true);
	}

	private handleOutsidePointer = (event: PointerEvent) => {
		const search = this.renderRoot.querySelector('.search');
		if (this.searchOpen && search && !event.composedPath().includes(search)) {
			this.searchOpen = false;
		}
	};

	private async openSearch() {
		this.searchOpen = true;
		await this.updateComplete;
		this.renderRoot.querySelector<HTMLInputElement>('.search-input')?.focus();
	}

	private handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			this.searchOpen = false;
			this.renderRoot.querySelector<HTMLButtonElement>('.search-button')?.focus();
		}
	}

	@property({ attribute: 'archive-url' })
	archiveUrl = '';

	render() {
		return html`
			<div class="map-frame">
				<div id="map" aria-label="Map of PUC-Rio"></div>
				<div class="search ${this.searchOpen ? 'open' : ''}" role="search"
					@keydown=${this.handleSearchKeydown}>
					<button class="search-button" type="button" aria-label="Abrir pesquisa"
						aria-expanded=${this.searchOpen} aria-controls="map-search"
						@click=${this.openSearch}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="2" stroke-linecap="round" aria-hidden="true">
							<circle cx="10.5" cy="10.5" r="6.5"></circle>
							<path d="m16 16 4.5 4.5"></path>
						</svg>
					</button>
					<input id="map-search" class="search-input" type="search"
						placeholder="Pesquisar no mapa" aria-label="Pesquisar no mapa"
						?disabled=${!this.searchOpen} />
				</div>
			</div>
		`;
	}

	firstUpdated() {
		const archiveBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
		const archiveUrl =
			this.archiveUrl || new URL('puc-rio.pmtiles', archiveBaseUrl).toString();

		this.map = new maplibregl.Map({
			container: this.renderRoot.querySelector('#map') as HTMLElement,
			bounds: MAP_BOUNDS,
			fitBoundsOptions: { padding: 36, maxZoom: 17 },
			minZoom: 16,
			maxZoom: 20,
			maxBounds: MAP_BOUNDS,
			style: {
				version: 8,
				glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
				sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
				sources: {
					basemap: {
						type: 'vector',
						url: `pmtiles://${archiveUrl}`,
						attribution:
							'<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
					},
				},
				layers: layers(
					'basemap',
					{ ...namedFlavor('light'), pois: undefined },
					{ lang: 'pt' },
				),
			},
		});
		const markerElement = document.createElement('div');
		markerElement.className = "pin";
		markerElement.innerHTML = pinSvg;
		
		new maplibregl.Marker({
			element: markerElement,
			anchor: 'bottom',

		})
		.setLngLat([-43.2335, -22.9795])
		
		.addTo(this.map);
		this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
	}


	disconnectedCallback() {
		this.ownerDocument.removeEventListener('pointerdown', this.handleOutsidePointer, true);
		super.disconnectedCallback();
		this.map?.remove();
		this.map = undefined;
	}
}
