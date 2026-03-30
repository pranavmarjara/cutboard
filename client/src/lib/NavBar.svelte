<script lang="ts">

import { onMount } from 'svelte';
import { curUsername, curUserPic, curVideo, mediaFileId, collabId, userMenuItems } from "@/stores";
import Avatar from '@/lib/Avatar.svelte';
import {latestProgressReports, clientConfig} from '@/stores';
import type { MediaProgressReport } from '@/types';
import { Dropdown, DropdownItem, DropdownDivider, DropdownHeader } from 'flowbite-svelte';
import EDLImport from './tools/EDLImport.svelte';
import ExportDialog from './tools/comment-export/ExportDialog.svelte';
import { ChevronRightOutline } from 'flowbite-svelte-icons';
import { Modal } from 'flowbite-svelte';
import * as Proto3 from '@clapshot_protobuf/typescript';
import { t, availableLocales, locale, setLocale } from '@/i18n';

interface Props {
    onbasicauthlogout?: () => void;
    onaddcomments?: (comments: Proto3.Comment[]) => void;
}

let { onbasicauthlogout, onaddcomments }: Props = $props();

let loggedOut = $state(false);
let localeOptions = $state(availableLocales);

let videoProgressMsg: string | undefined = $state(undefined);

onMount(async () => {
        latestProgressReports.subscribe((reports: MediaProgressReport[]) => {
                videoProgressMsg = reports.find((r: MediaProgressReport) => r.mediaFileId === $mediaFileId)?.msg;
        });
});

$effect(() => {
        if ($clientConfig?.supported_locales && $clientConfig.supported_locales.length > 0) {
                const allowed = new Set($clientConfig.supported_locales.map((l: string) => l.toLowerCase()));
                const filtered = availableLocales.filter((loc) => allowed.has(loc.id.toLowerCase()));
                localeOptions = filtered.length > 0 ? filtered : availableLocales;
        } else {
                localeOptions = availableLocales;
        }
});

function onLocaleChange(e: Event) {
        const newLocale = (e.target as HTMLSelectElement).value;
        setLocale(newLocale);
}

function logoutBasicAuth() {
    const logoutUrl = $clientConfig?.logout_url || "/logout";
        const nonce = Math.random().toString(36).substring(2, 15);

    console.log("Making request to " + logoutUrl + " with bad creds...");
    fetch(logoutUrl, {method:'GET', headers: {'Authorization': 'Basic ' + btoa('logout_user__'+nonce+':bad_pass__'+nonce)}})
        .then(res => {
            console.log("Logout response: " + res.status + " - " + res.statusText);
            if (res.status === 401) {
                console.log("Logout successful.");
                                if (onbasicauthlogout) onbasicauthlogout();
                                loggedOut = true;
            } else {
                alert("Basic auth logout failed.\nStatus code from " + logoutUrl + ": " + res.status + " (not 401)");
            }
        })
        .catch(error => {
            console.log("Error logging out: " + error);
        })
}

function showAbout() {
        alert("Clipyfy v" + process.env.CLAPSHOT_CLIENT_VERSION + "\n" +
                "Review video. Move faster.\n" +
                "\n" +
                "Built on Clapshot · github.com/elonen/clapshot");
}

async function copyToClipboard() {
        const urlParams = `?vid=${$mediaFileId}`;
        const currentUrl = window.location.href.split('?')[0];
        const fullUrl = currentUrl + urlParams;
        try {
                await navigator.clipboard.writeText(fullUrl);
                alert('Link copied to clipboard.\nSend it to reviewers who have user accounts here.');
        } catch (err) {
                console.error('Failed to copy link: ', err);
        }
}

const randomSessionId = Math.random().toString(36).substring(2, 15);

let isEDLImportOpen = $state(false);
let isExportOpen = $state(false);

function addEDLComments(comments: Proto3.Comment[]) {
        console.debug("addEDLComments", comments);
        if (onaddcomments) onaddcomments(comments);
}

</script>

<nav class="nav-bar px-6 py-0 h-14 flex items-center gap-4">

    <!-- Logo -->
    <a href="/" class="flex items-center gap-3 flex-shrink-0 group">
        <div class="logo-icon">
            <img
                src="{$clientConfig ? ($clientConfig?.logo_url || 'clapshot-logo.svg') : ''}"
                class="h-7 w-7 object-contain"
                alt="{$clientConfig ? ($clientConfig.app_title || 'Clipyfy') : ''}"
            />
        </div>
        <span class="nav-logo-text">
            {$clientConfig ? ($clientConfig.app_title || "Clipyfy") : ""}
        </span>
    </a>

    <!-- Center: video info -->
    <div class="flex-1 flex items-center justify-center min-w-0">
        {#if $mediaFileId}
        <div class="video-info-pill">
            <div class="flex items-center gap-2 min-w-0">
                <span class="video-id-badge">{$mediaFileId}</span>
                {#if $curVideo?.title}
                    <span class="nav-separator">·</span>
                    <span class="video-title-text" title={$curVideo?.title}>{$curVideo?.title}</span>
                {/if}
                {#if videoProgressMsg}
                    <span class="nav-separator">·</span>
                    <span class="progress-text">{videoProgressMsg}</span>
                {/if}
            </div>

            <!-- Video menu button -->
            <button
                class="video-menu-btn {$collabId ? 'collab-active' : ''}"
                aria-haspopup="true" aria-expanded="true" aria-label="Open menu"
            >
                {#if $collabId}
                    <i class="fas fa-users text-xs"></i>
                {:else}
                    <i class="fas fa-ellipsis text-xs"></i>
                {/if}
            </button>

            <Dropdown class="w-64 text-sm clapshot-dropdown" simple>
                <DropdownItem onclick={copyToClipboard}>
                    <i class="fas fa-share-square w-4 mr-2 opacity-60"></i>
                    {$t('nav.shareToLoggedInUsers')}
                </DropdownItem>
                {#if $curVideo?.origUrl}
                    <DropdownItem title="Download original file">
                        <a href={$curVideo?.origUrl} download class="flex items-center">
                            <i class="fas fa-download w-4 mr-2 opacity-60"></i>
                            {$t('nav.downloadOriginal')}
                        </a>
                    </DropdownItem>
                {/if}
                {#if $collabId}
                    <DropdownItem href="?vid={$mediaFileId}" class="text-emerald-400">
                        <i class="fas fa-users w-4 mr-2"></i>
                        {$t('nav.leaveCollab')}
                    </DropdownItem>
                {:else}
                    <DropdownItem href="?vid={$mediaFileId}&collab={randomSessionId}" title="Start collaborative session">
                        <i class="fas fa-user-plus w-4 mr-2 opacity-60"></i>
                        {$t('nav.startCollab')}
                    </DropdownItem>
                {/if}

                <DropdownItem>
                    <i class="fas fa-cog w-4 mr-2 opacity-60"></i>
                    {$t('nav.experimentalTools')}
                    <ChevronRightOutline class="w-4 h-4 ms-auto opacity-50" />
                </DropdownItem>
                <Dropdown placement="right-start" class="w-64 text-sm clapshot-dropdown" simple>
                    <DropdownItem onclick={() => isEDLImportOpen = true}>
                        <i class="fas fa-file-import w-4 mr-2 opacity-60"></i>
                        {$t('nav.importEdl')}
                    </DropdownItem>
                    <DropdownItem onclick={() => isExportOpen = true}>
                        <i class="fas fa-file-export w-4 mr-2 opacity-60"></i>
                        {$t('nav.exportComments')}
                    </DropdownItem>
                    <EDLImport bind:isOpen={isEDLImportOpen} onaddcomments={addEDLComments}/>
                    <ExportDialog bind:isOpen={isExportOpen}/>
                </Dropdown>
            </Dropdown>
        </div>
        {/if}
    </div>

    <!-- Right: user -->
    <div class="flex items-center gap-3 flex-shrink-0" style="visibility: {$curUsername ? 'visible': 'hidden'}">
        <span class="username-label">{$curUsername}</span>
        <button id="user-button" class="avatar-btn" aria-haspopup="true" aria-expanded="true">
            {#if $curUserPic || $curUsername}
                <div class="w-8 h-8 block rounded-full overflow-hidden ring-2 ring-[#2A3550] hover:ring-[#4F8EF7] transition-all duration-200">
                    <Avatar username={$curUsername} />
                </div>
            {/if}
        </button>

        {#if $userMenuItems != undefined && $userMenuItems.length > 0}
            <Dropdown class="w-48 text-sm clapshot-dropdown" simple>
                <DropdownItem class="flex items-center gap-2">
                    <span class="text-[#6B7A99]">{$t('nav.language')}</span>
                    <select
                        class="ml-auto bg-[#1E2840] text-xs rounded-md px-2 py-1 border border-[#2A3550] text-[#C8D3E8] focus:outline-none focus:ring-1 focus:ring-[#4F8EF7]"
                        value={$locale}
                        onchange={onLocaleChange}
                        aria-label={$t('nav.language')}
                    >
                        {#each localeOptions as loc}
                            <option value={loc.id} selected={loc.id === $locale}>{loc.label}</option>
                        {/each}
                    </select>
                </DropdownItem>
                <DropdownDivider class="border-[#1E2840]" />
                {#each $userMenuItems as item}
                    {#if item.type === "logout-basic-auth"}
                        <DropdownItem onclick={() => logoutBasicAuth()}>
                            <i class="fas fa-sign-out-alt w-4 mr-2 opacity-50"></i>
                            {$t('nav.logout')}
                        </DropdownItem>
                    {:else if item.type === "about"}
                        <DropdownItem onclick={showAbout}>
                            <i class="fas fa-info-circle w-4 mr-2 opacity-50"></i>
                            {$t('nav.about')}
                        </DropdownItem>
                    {:else if item.type === "divider"}
                        <DropdownDivider class="border-[#1E2840]" />
                    {:else if item.type === "url"}
                        <DropdownItem href={item.data || "#"}>{item.label}</DropdownItem>
                    {:else}
                        <DropdownItem>UNKNOWN item.type '{item.type}'</DropdownItem>
                    {/if}
                {/each}
            </Dropdown>
        {/if}
    </div>
</nav>

<Modal title={$t('nav.logout')} dismissable={false} bind:open={loggedOut} class="w-96">
    <p class="text-[#6B7A99]">
        <i class="fas fa-sign-in-alt mr-2"></i>
        {$t('status.reloadToLogin')}
    </p>
</Modal>


<style>
.nav-bar {
    background: rgba(13, 16, 26, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid #1E2840;
    position: sticky;
    top: 0;
    z-index: 100;
}

.logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(79,142,247,0.15), rgba(123,94,167,0.15));
    border: 1px solid rgba(79,142,247,0.2);
    flex-shrink: 0;
}

.nav-logo-text {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    font-family: 'Inter', sans-serif;
    background: linear-gradient(90deg, #F472B6 0%, #A78BFA 50%, #60A5FA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.video-info-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(22, 27, 42, 0.8);
    border: 1px solid #1E2840;
    border-radius: 24px;
    padding: 4px 8px 4px 12px;
    max-width: 480px;
    min-width: 0;
}

.video-id-badge {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.7rem;
    color: #4F8EF7;
    background: rgba(79,142,247,0.1);
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
}

.video-title-text {
    font-size: 0.8rem;
    color: #8A9BBD;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}

.nav-separator {
    color: #2A3550;
    flex-shrink: 0;
}

.progress-text {
    font-size: 0.7rem;
    color: #34D399;
    white-space: nowrap;
    flex-shrink: 0;
}

.video-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: transparent;
    color: #6B7A99;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
}
.video-menu-btn:hover {
    background: #1E2840;
    color: #C8D3E8;
}
.video-menu-btn.collab-active {
    color: #34D399;
    background: rgba(52,211,153,0.1);
}

.username-label {
    font-size: 0.8rem;
    color: #6B7A99;
    font-weight: 500;
}

.avatar-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
}
</style>
