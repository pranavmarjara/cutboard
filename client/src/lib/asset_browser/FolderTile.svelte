<script lang="ts">

import ScrubbableVideoThumb from './ScrubbableVideoThumb.svelte';
import { dndzone, TRIGGERS, SOURCES } from 'svelte-dnd-action';
import { selectedTiles } from '@/stores';
import * as Proto3 from '@clapshot_protobuf/typescript';
import TileVisualizationOverride from './TileVisualizationOverride.svelte';
import {rgbToCssColor, cssVariables} from './utils';

    interface Props {
        id?: any;
        name?: string;
        preview_items?: Proto3.PageItem_FolderListing_Item[];
        visualization?: Proto3.PageItem_FolderListing_Item_Visualization|undefined;
        ondropitemsinto?: (event: {folderId: any, items: any[]}) => void;
    }

    let {
        id = {},
        name = "",
        preview_items = [],
        visualization = undefined,
        ondropitemsinto
    }: Props = $props();


function contentPreviewItems(data: Proto3.PageItem_FolderListing_Item[]): Proto3.PageItem_FolderListing_Item[] {
    let items = data;
    if (items.length > 4) { items = items.slice(0,4); }
    return items;
}

let dndItems: any = $state([]);

function onSink(e: any) {
        console.log("Sunk #" + e.detail.items[0].id + " into #" + id)

    let newItems = [...e.detail.items].concat(
        Object.keys($selectedTiles).length ? [...Object.values($selectedTiles)] : []);
    newItems = newItems.filter((item, pos) =>
        newItems.map((mi) => mi['id']).indexOf(item['id']) === pos );

    if (ondropitemsinto) ondropitemsinto({'folderId': id, 'items': newItems});

    dndItems = [];
}

function consider(e: any) {
        if (e.detail.info.trigger == TRIGGERS.DRAG_STOPPED &&
                  e.detail.info.source == SOURCES.KEYBOARD) {
                onSink(e);
        } else {
                dndItems = e.detail.items;
        }
}

function finalize(e: any) {
        if (e.detail.info.source == SOURCES.KEYBOARD) {
                dndItems = e.detail.items;
        } else {
                onSink(e);
        }
}

let basecolor = $derived(visualization?.baseColor ?
    rgbToCssColor(visualization.baseColor.r, visualization.baseColor.g, visualization.baseColor.b) :
    '#1E3A5F');

</script>


<div class="folder-tile video-list-selector"
    style="position: relative;"
    class:draggingOver={dndItems.length>0}
    use:cssVariables={{basecolor}}
>
    <!-- DnD zone (invisible, full-area) -->
    <div class="folder-dnd-zone"
        use:dndzone="{{items: dndItems, morphDisabled: true, dragDisabled: true, zoneTabIndex: -1, centreDraggedOnCursor: true}}"
        onconsider={consider}
        onfinalize={finalize}
    >
        {#each dndItems as _item, _i}<span></span>{/each}
    </div>

    <!-- Folder visual -->
    <div class="video-list-folder folder-visual w-full h-full">
        <div class="folder-content" title={name}>
            <!-- Folder label -->
            <div class="folder-name-row">
                <i class="fas fa-folder text-xs opacity-60 flex-shrink-0"></i>
                <span class="folder-name" title={name}>{name}</span>
            </div>

            <!-- Preview grid -->
            {#if preview_items.length > 0}
                <div class="preview-grid">
                    {#each contentPreviewItems(preview_items) as prev}
                        <div class="preview-cell">
                            {#if prev.mediaFile?.previewData?.thumbUrl}
                                <ScrubbableVideoThumb
                                    extra_styles="border-radius:0; height:100%; width:auto; transform:translate(-50%,-50%); left:50%; top:50%; position:absolute; filter:opacity(60%);"
                                    thumbPosterUrl={prev.mediaFile.previewData?.thumbUrl}
                                    thumbSheetUrl={prev.mediaFile.previewData?.thumbSheet?.url}
                                    thumbSheetRows={prev.mediaFile.previewData?.thumbSheet?.rows}
                                    thumbSheetCols={prev.mediaFile.previewData?.thumbSheet?.cols}
                                />
                            {:else if prev.folder}
                                <div class="preview-subfolder">
                                    <i class="fas fa-folder text-[10px] opacity-40"></i>
                                </div>
                            {:else if prev.vis}
                                <TileVisualizationOverride
                                    extra_styles="filter: opacity(55%);"
                                    vis={prev.vis}/>
                            {/if}
                        </div>
                    {/each}
                </div>
            {:else if visualization}
                <div class="vis-override">
                    <TileVisualizationOverride vis={visualization}/>
                </div>
            {:else}
                <div class="empty-folder">
                    <i class="fas fa-inbox text-lg opacity-15"></i>
                </div>
            {/if}
        </div>
    </div>
</div>


<style>
.folder-tile {
    width: 100%;
    height: 100%;
    border-radius: 10px;
    overflow: hidden;
}

.folder-dnd-zone {
    position: absolute;
    inset: 0;
    z-index: 2;
}

.folder-visual {
    position: relative;
    z-index: 1;
}

.video-list-folder {
    background: linear-gradient(160deg,
        color-mix(in srgb, var(--basecolor) 80%, white 10%) 0%,
        var(--basecolor) 40%,
        color-mix(in srgb, var(--basecolor) 90%, black 20%) 100%
    );
    clip-path: polygon(0 22%, 0 5%, 4% 0, 30% 0, 48% 7%, 58% 7%, 98% 7%, 100% 10%, 100% 100%, 0 100%);
    border-radius: 0 8px 8px 8px;
    position: relative;
    overflow: hidden;
}

:global(.selectedTile .video-list-folder) {
    filter: brightness(1.15);
    box-shadow: 0 0 0 2px rgba(79,142,247,0.4);
}

:global(.activeDropTarget) .video-list-folder {
    filter: brightness(1.3);
}

.folder-content {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    top: 18%;
    display: flex;
    flex-direction: column;
    padding: 5px 7px 7px;
    gap: 4px;
}

.folder-name-row {
    display: flex;
    align-items: center;
    gap: 4px;
    color: rgba(255,255,255,0.75);
}

.folder-name {
    font-size: 0.65rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(255,255,255,0.8);
}

.preview-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 2px;
    border-radius: 5px;
    overflow: hidden;
    background: rgba(0,0,0,0.2);
}

.preview-cell {
    position: relative;
    overflow: hidden;
    background: rgba(0,0,0,0.3);
}

.preview-subfolder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.2);
    color: rgba(255,255,255,0.5);
}

.vis-override {
    flex: 1;
    border-radius: 5px;
    overflow: hidden;
}

.empty-folder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.4);
}

:global(.aboutToDrop) {
    border: 1px solid #4F8EF7;
    scale: 0.5;
}
</style>
