<script lang="ts">

import ScrubbableVideoThumb from './ScrubbableVideoThumb.svelte';
import TileVisualizationOverride from './TileVisualizationOverride.svelte';
import * as Proto3 from '@clapshot_protobuf/typescript';
import {rgbToCssColor, cssVariables} from './utils';
import {latestProgressReports} from '@/stores';
import {slide} from "svelte/transition";
import type { MediaProgressReport } from '@/types';


    interface Props {
        item: Proto3.MediaFile;
        visualization?: Proto3.PageItem_FolderListing_Item_Visualization|undefined;
    }

    let { item, visualization = undefined }: Props = $props();

export function data() { return item; }

let progress: number|undefined = $state(undefined);
let progressMsg: string|undefined = $state(undefined);

let basecolor = $derived(
    progress !== undefined ? rgbToCssColor(20, 24, 36) :
    visualization?.baseColor ?
        rgbToCssColor(visualization.baseColor.r, visualization.baseColor.g, visualization.baseColor.b) :
        rgbToCssColor(28, 34, 52)
);

$effect(() => {
    const report = $latestProgressReports?.find((r: MediaProgressReport) => r.mediaFileId === item.id);
    progress = report?.progress;
    progressMsg = report?.msg;
});

function fmt_date(d: Date | undefined) {
    if (!d) return "";
    return d.toISOString().split('T')[0];
}

</script>

<div class="video-tile video-list-video video-list-selector"
    use:cssVariables={{basecolor}}>

    <!-- Thumbnail area -->
    <div class="thumb-area">
        {#if item.previewData?.thumbUrl}
            <ScrubbableVideoThumb
                thumbPosterUrl={item.previewData?.thumbUrl}
                thumbSheetUrl={item.previewData?.thumbSheet?.url}
                thumbSheetRows={item.previewData?.thumbSheet?.rows}
                thumbSheetCols={item.previewData?.thumbSheet?.cols}
            />
        {:else if visualization}
            <TileVisualizationOverride vis={visualization}/>
        {:else}
            <div class="no-thumb-placeholder">
                <i class="fas fa-film text-2xl opacity-20"></i>
            </div>
        {/if}
        <!-- Hover overlay -->
        <div class="thumb-overlay">
            <i class="fas fa-play text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg"></i>
        </div>
    </div>

    <!-- Processing bar -->
    {#if progress !== undefined}
        <div transition:slide class="progress-section">
            <div class="progress-label">{progressMsg || 'Processing...'}</div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width: {progress * 100}%"></div>
            </div>
        </div>
    {/if}

    <!-- Metadata footer -->
    <div class="tile-footer">
        <div class="tile-meta-row">
            {#if item.id}
                <span class="tile-id">{item.id}</span>
            {/if}
            {#if fmt_date(item.addedTime)}
                <span class="tile-date">{fmt_date(item.addedTime)}</span>
            {/if}
        </div>
        <div class="tile-title" title={item.title}>{item.title}</div>
    </div>

</div>

<style>
.video-tile {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    overflow: hidden;
    background-color: var(--basecolor);
    transition: background-color 0.25s ease;
    border: 1px solid rgba(255,255,255,0.04);
    position: relative;
}

:global(.selectedTile .video-tile) {
    border-color: rgba(79,142,247,0.5);
    box-shadow: 0 0 0 2px rgba(79,142,247,0.25);
}

.thumb-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: rgba(0,0,0,0.3);
}

.thumb-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0);
    transition: background 200ms ease;
}
:global(.video-list-tile-sqr:hover) .thumb-overlay {
    background: rgba(0,0,0,0.25);
}

.no-thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111520;
}

.progress-section {
    padding: 4px 6px 2px;
    background: rgba(0,0,0,0.3);
}

.progress-label {
    font-size: 0.6rem;
    color: #34D399;
    text-align: center;
    margin-bottom: 3px;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.progress-bar-track {
    height: 2px;
    background: rgba(0,0,0,0.5);
    border-radius: 1px;
    overflow: hidden;
}

.progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4F8EF7, #34D399);
    border-radius: 1px;
    transition: width 300ms ease;
}

.tile-footer {
    padding: 5px 7px 6px;
    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
    flex-shrink: 0;
}

.tile-meta-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
}

.tile-id {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.6rem;
    color: #4F8EF7;
    background: rgba(79,142,247,0.12);
    padding: 0 4px;
    border-radius: 3px;
    flex-shrink: 0;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tile-date {
    font-size: 0.6rem;
    color: #3A4259;
    margin-left: auto;
    white-space: nowrap;
}

.tile-title {
    font-size: 0.7rem;
    color: #C8D3E8;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-weight: 500;
}
</style>
