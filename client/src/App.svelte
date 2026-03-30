<script lang="ts">
    import { preventDefault } from 'svelte/legacy';

import {Notifications, acts} from '@tadashi/svelte-notification'
import {fade, slide} from "svelte/transition";

import * as Proto3 from '@clapshot_protobuf/typescript';

import {allComments, curUsername, curUserId, videoIsReady, mediaFileId, curVideo, curPageId, curPageItems, userMessages, latestProgressReports, collabId, userMenuItems, serverDefinedActions, curUserIsAdmin, connectionErrors, curSubtitle, clientConfig} from './stores';
import {IndentedComment, type UserMenuItem, type StringMap, type MediaProgressReport} from "./types";
import { t, initLocale } from './i18n';

import CommentCard from './lib/player_view/CommentCard.svelte'
import SubtitleCard from './lib/player_view/SubtitleCard.svelte';
import NavBar from './lib/NavBar.svelte'
import CommentInput from './lib/player_view/CommentInput.svelte';
import UserMessage from './lib/UserMessage.svelte';
import FileUpload from './lib/asset_browser/FileUpload.svelte';
import VideoPlayer from './lib/player_view/VideoPlayer.svelte';
import {folderItemsToIDs, type VideoListDefItem} from "@/lib/asset_browser/types";
import FolderListing from './lib/asset_browser/FolderListing.svelte';
import LocalStorageCookies from './cookies';
import RawHtmlItem from './lib/asset_browser/RawHtmlItem.svelte';
import { indentCommentTree, countTimedRootComments, type CommentSortMode } from '@/lib/commentTree';
import { ClientToServerCmd } from '@clapshot_protobuf/typescript/dist/src/client';

let videoPlayer: VideoPlayer | undefined = $state();
let commentInput: CommentInput | undefined = $state();
let debugLayout: boolean = false;
let uiConnectedState: boolean = $state(false); // true if UI should look like we're connected to the server

let commentSortMode: CommentSortMode = $state((LocalStorageCookies.get('comment_sort_mode') as CommentSortMode) ?? 'timecode');

function toggleCommentSort() {
    commentSortMode = commentSortMode === 'timecode' ? 'date' : 'timecode';
    LocalStorageCookies.set('comment_sort_mode', commentSortMode, Number.MAX_SAFE_INTEGER);
    $allComments = indentCommentTree($allComments, commentSortMode);
}

let collabDialogAck = $state(false);  // true if user has clicked "OK" on the collab dialog
let lastCollabControllingUser: string | null = null;    // last user to control the video in a collab session

let forceBadBasicAuth = false;

let wsSocket: WebSocket | undefined;
let sendQueue: any[] = [];


function logAbbrev(...strs: any[]) {
    /*
    const maxLen = 180;
    let abbreviated: string[] = [];
    for (let i = 0; i < strs.length; i++) {
        let str = (typeof strs[i] == "string" || typeof strs[i] == "number" || typeof strs[i] == "boolean")
        ? String(strs[i])
        : JSON.stringify(strs[i]);
        abbreviated[i] = (str.length > maxLen) ? (str.slice(0, maxLen) + " ……") : str;
    }
    console.log(...abbreviated);
    */
    console.log(...strs);
}

// Log JSON object with console.dir, optionally wrapped in a message (op_name)
// If obj is a string, try to parse it as JSON first, then log it. If it fails, log the string as-is.
function richLog(obj: any, op_name: string|undefined = undefined, proto3_cmd: any = undefined) {

    let cmd_name = "";
    if (proto3_cmd) {
        const first_non_nullish_key = (obj: any) => Object.keys(obj).find(key => (obj[key] !== null && obj[key] !== undefined));
        cmd_name = first_non_nullish_key(proto3_cmd) ?? "(unknown cmd)";
    }

    let parsed = null;
    try { parsed = JSON.parse(obj); } catch (e) { parsed = obj; }

    if (op_name || cmd_name) {
        let prefix = (op_name ? ("["+op_name+"]") : "") + (cmd_name ? (" " + cmd_name) : "");
        console.log(prefix, parsed);
    }
    else console.log(parsed);
}


// Show last 5 connection errors and log everything to console
function showConnectionError(msg: string) {
    connectionErrors.update((errs: string[]) => {
        let t = new Date().toLocaleTimeString();
        errs.push(`[${t}] ${msg}`);
        return errs.slice(-10);
    });
    console.error("[CONNECTION ERROR]", msg);
}

// Messages from CommentInput component
function onCommentInputButton(e: any) {

    const PLAYBACK_REQ_SOURCE = "comment_input";
    function resumePlayer() {
        // Only resume if playback was paused by comment input
        if (videoPlayer && videoPlayer.getPlaybackState().request_source == PLAYBACK_REQ_SOURCE) {
            videoPlayer.setPlayback(true, PLAYBACK_REQ_SOURCE);
        }
    }
    function pausePlayer() {
        if (videoPlayer) {
            videoPlayer.setPlayback(false, PLAYBACK_REQ_SOURCE);
        }
    }

    if (e.action == "send")
    {
        if (videoPlayer && (e.comment_text != "" || videoPlayer.hasDrawing()))
        {
            wsEmit({addComment: {
                mediaFileId: $mediaFileId!,
                comment: e.comment_text,
                drawing: videoPlayer ? videoPlayer.getScreenshot() : "",
                timecode: e.is_timed && videoPlayer ? videoPlayer.getCurTimecode() : "",
                subtitleId: $curSubtitle?.id
            }});
        }
        resumePlayer();
    }
    else if (e.action == "text_input") {
        pausePlayer();   // auto-pause when typing a comment
    }
    else if (e.action == "color_select") {
        pausePlayer();
        if (videoPlayer) videoPlayer.onColorSelect(e.color);
    }
    else if (e.action == "draw") {
        if (e.is_draw_mode) { pausePlayer(); }
        if (videoPlayer) videoPlayer.onToggleDraw(e.is_draw_mode);
    }
    else if (e.action == "undo") {
        pausePlayer();
        if (videoPlayer) videoPlayer.onDrawUndo();
    }
    else if (e.action == "redo") {
        pausePlayer();
        if (videoPlayer) videoPlayer.onDrawRedo();
    }
}

function onDisplayComment(e: any) {
    if (!$curVideo) { throw Error("No video loaded"); }
    if (videoPlayer && e.timecode) videoPlayer.seekToSMPTE(e.timecode);
    // Close draw mode while showing (drawing from a saved) comment
    if (videoPlayer && e.drawing) { videoPlayer.setDrawing(e.drawing); }
    if (e.subtitleId) { $curSubtitle = $curVideo.subtitles.find((s) => s.id == e.subtitleId) ?? null; }
    if ($collabId) {
        logAbbrev("Collab: onDisplayComment. collab_id: '" + $collabId + "'");
        wsEmit({collabReport: {
            paused: true,
            loop: videoPlayer ? videoPlayer.isLooping() : false,
            seekTimeSec: videoPlayer ? videoPlayer.getCurTime() : 0,
            drawing: e.drawing,
            subtitleId: $curSubtitle?.id
        }});
    }
    if (videoPlayer) videoPlayer.onToggleDraw(false);
    if (commentInput) commentInput.forceDrawMode(false);
}

function onDeleteComment(e: any) {
    wsEmit({delComment: { commentId: e.id }});
}

function onReplyComment(e: { parentId: string; commentText: string, subtitleId?: string }) {
    console.log("onReplyComment: ", e);
    wsEmit({addComment: {
        mediaFileId: $mediaFileId!,
        parentId: e.parentId,
        comment: e.commentText,
        subtitleId: e.subtitleId,
    }});
}

function onEditComment(e: any) {
    wsEmit({editComment: {
        commentId: e.id,
        newComment: e.comment_text,
    }});
}

function onAddCommentsBulk(comments: Proto3.Comment[]) {
    for (let c of comments) {
        wsEmit({addComment: {
            mediaFileId: $mediaFileId!,
            comment: c.comment,
            drawing: c.drawing,
            timecode: c.timecode,
            subtitleId: c.subtitleId,
        }});
    }
}

function closePlayerIfOpen() {
    console.debug("closePlayerIfOpen()");
    wsEmit({leaveCollab: {}});
    $collabId = null;
    $mediaFileId = null;
    $curVideo = null;
    $allComments = [];
    $videoIsReady = false;
}

function onPlayerSeeked() {
    if (commentInput) commentInput.forceDrawMode(false);  // Close draw mode when video frame is changed
}

function onCollabReport(e: { report: Proto3.client.ClientToServerCmd_CollabReport; }) {
    if ($collabId) {
        wsEmit({collabReport: e.report});
    }
}

function activateComment(e: any) {
    // Unified comment activation function - handles both timecoded and non-timecoded comments
    // Called from: pin clicks, URL hash, and potentially other sources
    let commentId = e.id;
    let c = $allComments.find((c: { comment: { id: any; }; }) => c.comment.id == commentId);

    if (!c) {
        console.warn("Comment not found:", commentId);
        acts.add({mode: 'warning', message: 'Comment not found', lifetime: 3});
        return;
    }

    // If comment has a timecode, activate it on the timeline (seek, set loop points)
    if (c.comment.timecode && videoPlayer) {
        videoPlayer.activateCommentOnTimeline(commentId);
    }

    // Handle all the display logic (drawing, subtitle, collab, etc.)
    onDisplayComment({
        timecode: c.comment.timecode,
        drawing: c.comment.drawing,
        subtitleId: c.comment.subtitleId
    });

    // Scroll to comment card and highlight it
    let card = document.getElementById("comment_card_" + commentId);
    if (card) {
        card.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
        setTimeout(() => { card?.classList.add("highlighted_comment"); }, 500);
        setTimeout(() => { card?.classList.remove("highlighted_comment"); }, 3000);
    }
}

function onSubtitleChange(e: any) {
    const sub_id = e.id;
    if (!$curVideo) { throw Error("No video loaded"); }
    console.debug("onSubtitleChange, id:", sub_id, "allSubtitles:", $curVideo.subtitles);
    if ($curSubtitle?.id == sub_id) {
        $curSubtitle = null;
    } else {
        $curSubtitle = $curVideo.subtitles.find((s) => s.id == sub_id) ?? null;
        if ($curSubtitle == null && sub_id != null) {
            console.error("Subtitle not found: ", sub_id);
            acts.add({mode: 'error', message: "Subtitle not found. See log.", lifetime: 5});
        }
    }
    if ($collabId) {
        wsEmit({collabReport: {
            paused: videoPlayer ? videoPlayer.isPaused() : true,
            loop: videoPlayer ? videoPlayer.isLooping() : false,
            seekTimeSec: videoPlayer ? videoPlayer.getCurTime() : 0,
            drawing: videoPlayer ? videoPlayer.getScreenshot() : "",
            subtitleId: $curSubtitle?.id,
        }});
    }
    console.debug("Subtitle URL changed to: ", $curSubtitle?.playbackUrl);
}

// User clicked on subtitle upload icon
async function onUploadSubtitles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt, .vtt, .ssa, .ass';
    input.click();

    input.onchange = async () => {
        if (!input.files?.length) {
            console.log('No subtitle file selected. Skipping upload.');
            return;
        }
        for (let file of input.files) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    if (!event.target?.result) { throw new Error('No file contents read'); }
                    const dataUrl = event.target.result as string;
                    const [_, contentsBase64] = dataUrl.split(',');
                    wsEmit({ addSubtitle : {
                        mediaFileId: $mediaFileId!,
                        fileName: file.name,
                        contentsBase64
                    }});
                } catch (e) {
                    console.error('Error adding subtitle file:', e);
                    acts.add({mode: 'error', message: 'Error adding subtitle file. See log.', lifetime: 5});
                }
            };
            reader.readAsDataURL(file);
        }
    };
}

function onSubtitleDelete(e: any) {
    const sub_id = e.id;
    if (window.confirm("Are you sure you want to delete this subtitle?")) {
        if ($curSubtitle?.id == sub_id) { $curSubtitle = null; }
        wsEmit({ delSubtitle: { id: sub_id } });
    }
}

/*
export interface ClientToServerCmd_EditSubtitleInfo {
    id: string;
    title?: string | undefined;
    languageCode?: string | undefined;
    timeOffset?: number | undefined;
    _unknownFields?: {
        [key: number]: Uint8Array[];
    } | undefined;
}
*/

async function onSubtitleUpdate(e: any) {
    const sub = e.sub;
    const isDefault = e.isDefault;
    if (isNaN(sub.timeOffset)) {
        console.error("Invalid time offset: ", sub.timeOffset);
        acts.add({mode: 'error', message: "Invalid time offset: " + sub.timeOffset, lifetime: 5});
        return;
    }
    wsEmit({ editSubtitleInfo: {
        id: sub.id,
        title: sub.title,
        languageCode: sub.languageCode,
        timeOffset: sub.timeOffset,
        isDefault,
    }});
}

function popHistoryState(e: PopStateEvent) {
    console.debug("popHistoryState called. e.state=", e.state);

    // If state is present, use it
    if (e.state) {
        if (e.state.mediaFileId) {
            console.debug("popHistoryState: Opening video: ", e.state.mediaFileId);
            wsEmit({ openMediaFile: { mediaFileId: e.state.mediaFileId } });
            return;
        } else if (e.state.pageId) {
            console.debug("popHistoryState: Opening page: ", e.state.pageId);
            wsEmit({openNavigationPage: {pageId: e.state.pageId ?? undefined}});
            return;
        }
    }

    // State might be empty if URL was pasted directly - check URL parameters
    const currentParams = new URLSearchParams(window.location.search);
    const vidParam = currentParams.get('vid');
    const pageParam = currentParams.get('p');

    if (vidParam) {
        console.debug("popHistoryState: Empty state but found vid param, opening video:", vidParam);
        wsEmit({ openMediaFile: { mediaFileId: vidParam } });
        return;
    } else if (pageParam) {
        console.debug("popHistoryState: Empty state but found page param, opening page:", pageParam);
        wsEmit({openNavigationPage: {pageId: decodeURIComponent(pageParam)}});
        return;
    }

    console.debug("popHistoryState: Resetting UI view due to empty state and no URL params");
    closePlayerIfOpen();
    wsEmit({openNavigationPage: {pageId: undefined}});
}

// On full page load, parse URL parameters to see if we have a
// video or page ID to open directly.
const prevCollabId = $collabId;

const urlParams = new URLSearchParams(window.location.search);
urlParams.forEach((value, key) => {
    if (key != "vid" && key != "collab" && key != "p") {
        console.error("Got UNKNOWN URL parameter: '" + key + "'. Value= " + value);
        acts.add({mode: 'warn', message: "Unknown URL parameter: '" + key + "'", lifetime: 5});
    }
});

console.debug("Parsing URL params: ", urlParams);

$mediaFileId = urlParams.get('vid');
$collabId = urlParams.get('collab');

const encodedPageParm = urlParams.get('p');
$curPageId = encodedPageParm ? decodeURIComponent(encodedPageParm) : null;

// Parse URL hash for direct comment links (#comment_{id})
const urlHash = window.location.hash;
const commentHashMatch = urlHash.match(/^#comment_(.+)$/);
const commentIdFromHash = commentHashMatch ? commentHashMatch[1] : null;

// Track whether we've activated the hash comment yet
let hashCommentActivated = false;

// Helper function to try activating comment from URL hash
function tryActivateHashComment() {
    if (hashCommentActivated || !commentIdFromHash) {
        return;
    }

    if ($videoIsReady && $allComments.length > 0) {
        hashCommentActivated = true;
        setTimeout(() => {
            activateComment({id: commentIdFromHash});
            // Clear hash after activation to avoid confusion on refresh/reshare
            history.replaceState(history.state, '', window.location.href.split('#')[0]);
        }, 1000);
    }
}

// Watch for video ready state changes to try activating hash comment
$effect(() => {
    if ($videoIsReady) {
        tryActivateHashComment();
    }
});

if ($mediaFileId && $collabId)
    history.replaceState({mediaFileId: $mediaFileId}, '', `/?vid=${$mediaFileId}&collab=${$collabId}${urlHash}`);
else if ($mediaFileId)
    history.replaceState({mediaFileId: $mediaFileId}, '', `/?vid=${$mediaFileId}${urlHash}`);
else if ($curPageId)
    history.replaceState({pageId: $curPageId}, '', `/?p=${encodeURIComponent($curPageId)}`);
else
    history.replaceState({}, '', './');


let uploadUrl: string = $state("");


// -------------------------------------------------------------
// Websocket messaging
// -------------------------------------------------------------

// Read config from HTTP server first
const CONF_FILE = "clapshot_client.conf.json";
function handleErrors(response: any) {
    if (!response.ok)
        throw Error("HTTP error: " + response.status);
    return response;
}
fetch(CONF_FILE)
.then(handleErrors)
.then(response => response.json())
.then(json => {
    // Check that we have all the expected config lines
    const expected = ["ws_url", "upload_url", "user_menu_extra_items", "user_menu_show_basic_auth_logout"];
    for (let key of expected) {
        if (!(key in json))
            throw Error("Missing key '" + key + "' in client config file '" + CONF_FILE + "'");
    }
    console.log("Config file '" + CONF_FILE + "' parsed: ", json);
    uploadUrl = json.upload_url;

    $clientConfig = json;
    initLocale(json.default_locale, json.supported_locales ?? null);

    console.log("Connecting to WS API at: " + json.ws_url);
    connectWebsocket(json.ws_url);

    $userMenuItems = json.user_menu_extra_items;
    if (json.user_menu_show_basic_auth_logout) {
        $userMenuItems = [...$userMenuItems, {label: "Logout", type: "logout-basic-auth"} as UserMenuItem];
    }
    $userMenuItems = [...$userMenuItems, {label: "About", type: "about"} as UserMenuItem];
})
.catch(error => {
    showConnectionError(`Failed to read config file '${CONF_FILE}': ${error}`);
});


let videoListRefreshScheduled = false;
function refreshMyMediaFiles()
{
    if (!videoListRefreshScheduled) {
        videoListRefreshScheduled = true;
        setTimeout(() => {
            videoListRefreshScheduled = false;
            if (!$mediaFileId) {
                console.debug("refreshMyMediaFiles timer fired, no mediaFileId. Requesting openNavigationPage.");
                wsEmit({openNavigationPage: {pageId: $curPageId ?? undefined}});
            } else {
                console.debug("refreshMyMediaFiles timer fired, mediaFileId present. Ignoring.");
            }
        }, 500);
    }
}


function isConnected() {
    return wsSocket && wsSocket.readyState == wsSocket.OPEN;
}

function disconnect() {
    closePlayerIfOpen();
    $curPageId = null;
    if (wsSocket) {
        wsSocket.close();
    }
    uiConnectedState = false;
}

function basicAuthLogout() {
    forceBadBasicAuth = true;
    disconnect();
}


// Send message to server. If not connected, queue it.
function wsEmit(cmd: ClientToServerCmd)
{
    let cookies = LocalStorageCookies.getAllNonExpired();
    let raw_msg = JSON.stringify({ ...cmd, cookies });

    if (isConnected()) {
        richLog(raw_msg, "SEND", cmd);
        wsSocket?.send(raw_msg);
    }
    else {
        richLog(raw_msg, "SEND (disconnected, so queuing)", cmd);
        sendQueue.push(raw_msg);
    }
}


// Infinite loop that sends messages from the queue.
// This only ever sends anything if ws_emit() queues messages due to temporary disconnection.
function sendQueueLoop()
{
    while (wsSocket && sendQueue.length > 0) {
        let raw_msg = sendQueue.shift();
        wsSocket.send(raw_msg);
    }
    setTimeout(sendQueueLoop, 500);
}
setTimeout(sendQueueLoop, 500); // Start the loop


let reconnectDelay = 100;  // for exponential backoff


function connectWebsocket(wsUrl: string) {
    const http_health_url = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/api\/.*$/, "/api/health");

    let headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Clapshot-Cookies': JSON.stringify(LocalStorageCookies.getAllNonExpired()),
    });

    if (forceBadBasicAuth) {
        // Health should always return 200, which might trick some browsers to keep the bad basic auth credentials, effectively logging out the user.
        const nonce = Math.random().toString(36).substring(2, 15);
        headers.set('Authorization', 'Basic ' + btoa('logout_user__'+nonce+':bad_pass__'+nonce));
    }

    let req_init: RequestInit = { method: 'GET', headers };

    function scheduleReconnect() {
        reconnectDelay = Math.round(Math.min(reconnectDelay * 1.5, 30_000)) + Math.random() * 1000;
        console.log("API reconnecting in " + reconnectDelay + " ms");
        setTimeout(() => { connectWebsocket(wsUrl); }, reconnectDelay);
        setTimeout(() => { if (!isConnected()) uiConnectedState = false; }, 3000);
    }

    try {
        return fetch(http_health_url, {
            ...req_init,
            redirect: 'manual', // don’t auto-follow 302→login so we detect “not authenticated”
            credentials: 'same-origin'
        }).then(response => {
            if (response.ok) {
                console.log("Authentication check OK. Connecting to WS API");
                return connectWebsocketAfterAuthCheck(wsUrl);
            } else {
                if (response.status === 401 || response.status === 403 ||
                    response.status === 301 || response.status === 302)
                {
                    if (reconnectDelay > 1500) {   // don't reload too often
                        console.warn("Got auth error or redirect from API endpoint. Reloading page to show login screen.");
                        window.location.reload()
                    } else {
                        scheduleReconnect();
                    }
                }
                showConnectionError(`API connect returned '${http_health_url}': ${response.status} - ${response.statusText}`);
            }
        })
        .catch(error => {
            if (error.name === 'TypeError' && error.message == 'Failed to fetch') {
            showConnectionError(`Network error fetching '${http_health_url}'`);
            } else {
                showConnectionError(`Failed to fetch '${http_health_url}': ${error}`);
            }
            scheduleReconnect();
        });
    } catch (error) {
        showConnectionError(`Connect to '${wsUrl}' failed: ${error}`);
        scheduleReconnect();
    }
}


// Sets a temporary progress bar / message for a media file.
// This is used to show transcoding progress.
function addMediaProgressReport(mediaFileId?: String, msg?: String, progress?: number)
{
    let report = { mediaFileId, msg, progress, received_ts: Date.now() } as MediaProgressReport

    // Filter out any old reports for this media file
    $latestProgressReports = $latestProgressReports.filter((r: MediaProgressReport) => r.mediaFileId != report.mediaFileId);
    if (report.progress !== undefined && report.progress < 1.0) {  // Hide progress bar immediately when done
        $latestProgressReports = [...$latestProgressReports, report];
    }

    // Schedule a cleanup of expired reports
    setTimeout(() => {
        $latestProgressReports = $latestProgressReports.filter((r: MediaProgressReport) => r.received_ts > (Date.now() - 6000));
        $latestProgressReports = [...$latestProgressReports];   // force svelte to re-render
    }, 1000);
}


// Called after we get the API URL from the server.
function connectWebsocketAfterAuthCheck(ws_url: string)
{
    if (!ws_url) throw Error("API URL not specified in config file");

    console.log("...CONNECTING to WS API: " + ws_url);
    wsSocket = new WebSocket(ws_url);


    // Handle connection opening
    wsSocket.addEventListener("open", function (_event) {
        reconnectDelay = 100;
        uiConnectedState = true;
        connectionErrors.set([]);

        if ($mediaFileId) {
            console.debug(`Socket connected, mediaFileId=${mediaFileId}. Requesting openMediaFile`);
            wsEmit({openMediaFile: { mediaFileId: $mediaFileId }});
        } else {
            console.debug("Socket connected, no mediaFileId. Requesting openNavigationPage");
            wsEmit({openNavigationPage: {pageId: $curPageId ?? undefined}});
            wsEmit({listMyMessages: {}});
        }
    });

    function handleWithErrors(func: { (): any; }): any {
        try {
            return func();
        } catch (e: any) {
            // log message, fileName, lineNumber
            console.error("Exception in Websocket handler: ", e);
            console.log(e.stack);
            acts.add({mode: 'danger', message: 'Client error: ' + e, lifetime: 5});
        }
    }

    // Reconnect if closed, with exponential+random backoff
    wsSocket.addEventListener("close", function (_event) {
        reconnectDelay = Math.round(Math.min(reconnectDelay * 1.5, 5000));
        console.log("API reconnecting in " + reconnectDelay + " ms");
        setTimeout(() => { connectWebsocket(ws_url); }, reconnectDelay);
        setTimeout(() => { if (!isConnected()) uiConnectedState = false; }, 3000);
    });

    if (prevCollabId != $collabId) {
        // We have a new collab id. Close old and open new one.
        if (prevCollabId)
            wsEmit({leaveCollab: {}});
        if ($collabId)
            wsEmit({joinCollab: { collabId: $collabId, mediaFileId: $mediaFileId! }});
    }

    // Incoming messages
    wsSocket.addEventListener("message", function (event)
    {
        let cmd = null;
        try {
            const msgJson = JSON.parse(event.data);
            cmd = Proto3.client.ServerToClientCmd.fromJSON(JSON.parse(event.data));
            if (!cmd) {
                console.error("Got INVALID message: ", msgJson);
                return;
            }
        } catch (e) {
            console.error("Error parsing incoming message: ", e);
            console.error("Message data: ", event.data);
            return;
        }

        richLog(event.data, "RECV", cmd);
        handleWithErrors(() =>
        {
            // welcome
            if (cmd.welcome) {
                if (!cmd.welcome.hasOwnProperty("serverVersion") || (process.env.CLAPSHOT_MIN_SERVER_VERSION && cmd.welcome.serverVersion < process.env.CLAPSHOT_MIN_SERVER_VERSION)) {
                    const msg = "Server version too old (v" + cmd.welcome.serverVersion + "). Please update server.";
                    console.error(msg);
                    window.alert(msg);
                    return;
                }
                console.log("Connected to server v" + cmd.welcome.serverVersion);
                if (process.env.CLAPSHOT_MAX_SERVER_VERSION && cmd.welcome.serverVersion > process.env.CLAPSHOT_MAX_SERVER_VERSION) {
                    const msg = "Client version too old (client v" + process.env.CLAPSHOT_CLIENT_VERSION + " for server v" + cmd.welcome.serverVersion + "). Please update client.";
                    console.error(msg);
                    window.alert(msg);
                    return;
                }

                if (!cmd.welcome.user) {
                    console.error("No user in welcome message");
                    acts.add({mode: 'danger', message: 'No user in welcome message', lifetime: 5});
                    return;
                }
                $curUsername = cmd.welcome.user.name ?? cmd.welcome.user.id;
                $curUserId = cmd.welcome.user.id;
                $curUserIsAdmin = cmd.welcome.isAdmin;
            }
            // error
            else if (cmd.error) {
                console.error("[SERVER ERROR]: ", cmd.error);
                acts.add({mode: 'danger', message: cmd.error.msg, lifetime: 5});
            }
            // showPage
            else if (cmd.showPage) {
                // Empty showPage (no pageItems, no pageId) = refresh hint: folder contents may have changed
                if (!cmd.showPage.pageItems?.length && !cmd.showPage.pageId) {
                    if (!$mediaFileId) {
                        wsEmit({openNavigationPage: {pageId: $curPageId ?? undefined}});
                    }
                    return;
                }
                const newPageId = cmd.showPage.pageId ?? null;  // turn undefined into null
                console.debug("showPage. newPageId=", newPageId, "$curPageId=", $curPageId);

                // Record page ID in browser history
                if (newPageId !== $curPageId) {   // Changed id looks like a new page to user
                    if (newPageId !== null) {
                        console.debug("[Browser history] Pushing new page state: ", newPageId);
                        history.pushState({pageId: newPageId}, '', `/?p=${encodeURIComponent(newPageId)}`);
                        document.title = "Clapshot - " + (cmd.showPage.pageTitle ?? newPageId);
                    } else {
                        console.debug("[Browser history] Pushing empty state (default page)");
                        history.pushState({pageId: null}, '', './');
                        document.title = "Clapshot - Home";
                    }
                }

                $curPageId = newPageId;
                closePlayerIfOpen();  // No-op if no video is open
                $curPageItems = [...cmd.showPage.pageItems];  // force svelte to re-render
            }
            // defineActions
            else if (cmd.defineActions) {
                for (var name in cmd.defineActions.actions)
                    $serverDefinedActions[name] = cmd.defineActions.actions[name];
            }
            // messages
            else if (cmd.showMessages) {
                for (const msg of cmd.showMessages.msgs) {
                    if ( msg.type === Proto3.UserMessage_Type.PROGRESS ) {
                        addMediaProgressReport(msg.refs?.mediaFileId, msg.message, msg.progress);
                    }
                    else if ( msg.type === Proto3.UserMessage_Type.MEDIA_FILE_UPDATED ) {
                        refreshMyMediaFiles();
                    }
                    else if ( msg.type === Proto3.UserMessage_Type.MEDIA_FILE_ADDED ) {
                        console.log("Handling MEDIA_FILE_ADDED: ", msg);
                        if (!msg.refs?.mediaFileId) { console.error("MEDIA_FILE_ADDED message with no mediaFileId. This is a bug."); }

                        // Parse details and extract JSON data (added by FileUpload) from msg
                        const uploadCookies = JSON.parse(msg.details ?? '{}');
                        const listingData = JSON.parse(uploadCookies.listing_data_json ?? '{}');
                        const addedAction = uploadCookies.media_file_added_action;

                        // Call organizer script if defined, otherwise refresh video list
                        if (addedAction) {
                            const action = $serverDefinedActions[addedAction];
                            if (!action) {
                                const errorMsg = `Undefined media_file_added_action: '${addedAction}'`;
                                acts.add({ mode: 'error', message: errorMsg, lifetime: 5 });
                                console.error(errorMsg);
                            } else {
                                callOrganizerScript(action.action, {
                                    media_file_id: msg.refs?.mediaFileId,
                                    listing_data: listingData,
                                });
                            }
                        } else {
                            refreshMyMediaFiles();
                        }
                    }
                    else {
                        $userMessages = $userMessages.filter((m) => m.id != msg.id);
                        if (msg.created) { $userMessages.push(msg); }
                        if (!msg.seen) {
                            const severity = (msg.type == Proto3.UserMessage_Type.ERROR) ? 'danger' : 'info';
                            let fileinfo = msg.refs?.mediaFileId ? (msg.refs.mediaFileId + " – ") : "";
                            acts.add({mode: severity, message: fileinfo + msg.message, lifetime: 5});
                            if (severity == 'info') {
                                refreshMyMediaFiles();    // hack, rename and other such actions send info notifications
                            }
                        };
                        $userMessages = [...$userMessages];  // force svelte to re-render

                        // Some "normal" messages can also set progress bars (e.g. "Transcoding done")
                        if (msg.progress !== undefined && msg.refs?.mediaFileId) {
                            addMediaProgressReport(msg.refs?.mediaFileId, msg.message, msg.progress);
                        }
                    }
                }
            }
            // openMediaFile
            else if (cmd.openMediaFile) {
                try {
                    const v: Proto3.MediaFile = cmd.openMediaFile.mediaFile!;
                    if (!v.playbackUrl) throw Error("No playback URL");
                    if (!v.duration) throw Error("No duration");
                    if (!v.title) throw Error("No title");

                    $curPageId = null;  // Clear the current page ID, so popHistoryState will know to reopen it if needed

                    if ($mediaFileId != v.id) {
                        console.debug("[Browser history] Pushing new media file state: ", v.id);
                        history.pushState({mediaFileId: v.id}, '', `/?vid=${v.id}`);
                        document.title = "Clapshot - " + (v.title ?? v.id);
                    }

                    $mediaFileId = v.id;
                    $curVideo = v;
                    $allComments = [];

                    if (v.defaultSubtitleId) {
                        $curSubtitle = $curVideo.subtitles.find((s) => s.id == v.defaultSubtitleId) ?? null;
                    } else {
                        let old_id = $curSubtitle?.id;
                        $curSubtitle = $curVideo.subtitles.find((s) => s.id == old_id) ?? null;
                    }

                    if ($collabId)
                        wsEmit({joinCollab: { collabId: $collabId, mediaFileId: $mediaFileId! }});

                } catch(error) {
                    acts.add({mode: 'danger', message: 'Bad video open request. See log.', lifetime: 5});
                    console.error("Invalid video open request. Error: ", error);
                }
            }
            // addComments
            else if (cmd.addComments) {

                // Add/replace the new comments
                for (const newComment of cmd.addComments.comments) {
                    if (newComment.mediaFileId != $mediaFileId) {
                        console.warn("Comment not for current video. Ignoring.");
                        continue;
                    }
                    $allComments = $allComments.filter((c: { comment: { id: string; }; }) => c.comment.id !== newComment.id);
                    $allComments.push({
                        comment: newComment,
                        indent: 0
                    });
                }

                // Re-sort / turn updated comment tree into an indented, ordered list for UI
                $allComments = indentCommentTree($allComments, commentSortMode);

                // Try to activate comment from URL hash if conditions are met
                tryActivateHashComment();
            }
            // delComment
            else if (cmd.delComment) {
                $allComments = $allComments.filter((c: { comment: { id: string; }; }) => c.comment.id != cmd.delComment!.commentId);
            }
            // collabEvent
            else if (cmd.collabEvent) {
                const evt = cmd.collabEvent;
                if (evt.subtitleId != $curSubtitle?.id) {
                    $curSubtitle = $curVideo?.subtitles.find((s) => s.id == evt.subtitleId) ?? null;
                }
                if (videoPlayer) {
                    if (!evt.paused) {
                        videoPlayer.collabPlay(evt.seekTimeSec, evt.loop);
                    } else {
                        videoPlayer.collabPause(evt.seekTimeSec, evt.loop, evt.drawing);
                    }
                }
                if (lastCollabControllingUser != evt.fromUser) {
                    lastCollabControllingUser = evt.fromUser;
                    acts.add({mode: 'info', message: lastCollabControllingUser + " is controlling", lifetime: 5});
                }
            }
            // setCookies
            else if (cmd.setCookies) {
                let cookie_dict = cmd.setCookies.cookies;
                if (!cookie_dict) {
                    console.error("[SERVER] setCookies command with no cookies. Cmd:", cmd);
                } else {
                    let expireTimestamp = cmd.setCookies.expireTime?.getTime() ?? null;
                    for (const [key, value] of Object.entries(cookie_dict)) {
                        LocalStorageCookies.set(key, value, expireTimestamp);
                    }
                }
            }
            else {
                console.error("[SERVER] UNKNOWN command from server:", cmd);
            }
        });
    });
}

function onMoveItemsToFolder(e: {detail: {dstFolderId: string; ids: Proto3.FolderItemID[], listingData: StringMap}}) {
    let {dstFolderId, ids, listingData} = e.detail;
    wsEmit({moveToFolder: { dstFolderId, ids, listingData }});
}

function onReorderItems(e: {detail: {ids: Proto3.FolderItemID[], listingData: StringMap}}) {
    let {ids, listingData} = e.detail;
    wsEmit({reorderItems: { listingData, ids }});
}

function openMediaFileListItem(e: { detail: { item: Proto3.PageItem_FolderListing_Item, listingData: StringMap }}): void {
    let {item, listingData} = e.detail;
    if (item.openAction) {
        callOrganizerScript(item.openAction, {
            listing_data: listingData,
            item_to_open: item
        });
    } else {
        console.error("No openAction script for item: " + item);
        acts.add({mode: 'error', message: "No open action for item. See log.", lifetime: 5});
    }
}

// ------------

// Expose some API functions to browser JS (=scripts from Server and Organizer)

(window as any).clapshot = {
    openMediaFile: (mediaFileId: string) => { wsEmit({ openMediaFile: { mediaFileId } }) },
    renameMediaFile: (mediaFileId: string, newName: string) => { wsEmit({ renameMediaFile: { mediaFileId, newName } }) },
    delMediaFile: (mediaFileId: string) => { wsEmit({ delMediaFile: { mediaFileId } }) },

    callOrganizer: (cmd: string, args: Object) => { wsEmit({ organizerCmd: { cmd, args: JSON.stringify(args) } }) },
    itemsToIDs: (items: Proto3.PageItem_FolderListing_Item[]): Proto3.FolderItemID[] => { return folderItemsToIDs(items) },
    moveToFolder: (
        dstFolderId: string,
        ids: Proto3.FolderItemID[],
        listingData: StringMap) => { wsEmit({ moveToFolder: { dstFolderId, ids, listingData } }) },
    reorderItems: (
        ids: Proto3.FolderItemID[],
        listingData: StringMap) => { wsEmit({ reorderItems: { ids, listingData } }) },
};

/// Evalute a string as Javascript from Organizer (or Server)
function callOrganizerScript(script: Proto3.ScriptCall|undefined, action_args: Object): void {
    if (!script || !script.code ) {
        console.log("callOrganizerScript called with empty code. Ignoring.");
        return;
    }
    if (script.lang != Proto3.ScriptCall_Lang.JAVASCRIPT ) {
        console.error("BUG: Unsupported Organizer script language: " + script.lang);
        acts.add({mode: 'error', message: "BUG: Unsupported script lang. See log.", lifetime: 5});
        return;
    }
    const Function = function () {}.constructor;
    // @ts-ignore
    let scriptFn = new Function("_action_args", script.code);
    console.log("Calling organizer script:", {action_args, code: script.code});
    try {
        scriptFn(action_args);
    } catch (e: any) {
        console.error("Error in organizer script:", e);
        acts.add({mode: 'error', message: "Organizer script error. See log.", lifetime: 5});
    }
}

function onMediaFileListPopupAction(e: { detail: { action: Proto3.ActionDef, items: VideoListDefItem[], listingData: StringMap }})
{
    let {action, items, listingData} = e.detail;
    let itemsObjs = items.map((it) => it.obj);
    console.log("onMediaFileListPopupAction():", {action, itemsObjs, listingData});
    callOrganizerScript(action.action, {
                listing_data: listingData,
                selected_items: itemsObjs
            });
}
</script>


<svelte:window onpopstate={popHistoryState}/>

<main>
    <span id="popup-container"></span>
    <div class="app-shell {debugLayout?'border-2 border-yellow-300':''}">
        <div class="flex-none w-full"><NavBar onbasicauthlogout={basicAuthLogout} onaddcomments={onAddCommentsBulk}/></div>
        <div class="app-content {debugLayout?'border-2 border-cyan-300':''}">
            <Notifications />

        {#if !uiConnectedState}

        <!-- ========== hero / connecting screen ============= -->
        <div transition:fade class="hero-screen">

            <!-- Background grid decoration -->
            <div class="hero-grid-bg" aria-hidden="true"></div>

            <!-- Top glow -->
            <div class="hero-glow" aria-hidden="true"></div>

            <div class="hero-inner">

                <!-- Badge -->
                <div class="hero-badge">
                    <span class="hero-badge-dot"></span>
                    Video review, reimagined
                </div>

                <!-- Wordmark -->
                <h1 class="hero-title">CutBoard</h1>

                <!-- Tagline -->
                <p class="hero-tagline">Review video. Move faster.</p>

                <!-- Description -->
                <p class="hero-description">
                    Upload footage, leave timestamped feedback, and collaborate in real time — without messy threads or endless revisions.
                </p>

                <!-- CTAs -->
                <div class="hero-ctas">
                    <button class="hero-btn-primary" disabled title="Connect to server to upload">
                        <i class="fas fa-cloud-arrow-up text-sm mr-2"></i>
                        Upload Video
                    </button>
                    <a class="hero-btn-secondary" href="https://github.com/elonen/clapshot" target="_blank" rel="noopener">
                        View on GitHub
                        <i class="fas fa-arrow-right text-xs ml-2"></i>
                    </a>
                </div>

                <!-- Feature pills -->
                <div class="hero-pills">
                    <span class="hero-pill"><i class="fas fa-clock text-[10px] mr-1.5 opacity-60"></i>Timestamped comments</span>
                    <span class="hero-pill"><i class="fas fa-users text-[10px] mr-1.5 opacity-60"></i>Real-time collab</span>
                    <span class="hero-pill"><i class="fas fa-pen-fancy text-[10px] mr-1.5 opacity-60"></i>Draw annotations</span>
                    <span class="hero-pill"><i class="fas fa-server text-[10px] mr-1.5 opacity-60"></i>Self-hosted</span>
                </div>

                <!-- Connecting status -->
                <div class="hero-status">
                    <div class="hero-status-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <span class="hero-status-text">{$t('status.connecting')}</span>

                    {#if $connectionErrors.length > 0}
                        <details class="conn-error-details">
                            <summary class="conn-error-summary">
                                <i class="fas fa-triangle-exclamation text-[10px] mr-1"></i>
                                {$t('status.viewConnectionErrors')}
                            </summary>
                            <ul class="conn-error-list">
                                {#each $connectionErrors as ce}
                                <li><code>{ce}</code></li>
                                {/each}
                            </ul>
                            <p class="conn-error-hint">Check browser console for details.</p>
                        </details>
                    {/if}
                </div>

            </div>
        </div>

        {:else if $mediaFileId && $curVideo && $curVideo.playbackUrl}

        <!-- ========== video review layout ============= -->
        <div transition:slide class="review-layout {debugLayout?'border-2 border-blue-700':''}">

            <!-- Left: player + comment input -->
            <div class="player-column {debugLayout?'border-2 border-purple-600':''}">
                <div class="player-area">
                    <VideoPlayer
                        bind:this={videoPlayer} src={$curVideo.playbackUrl}
                        onseeked={onPlayerSeeked}
                        oncollabreport={onCollabReport}
                        oncommentpinclicked={activateComment}
                        onuploadsubtitles={onUploadSubtitles}
                        onchangesubtitle={onSubtitleChange}
                    />
                </div>
                <div class="comment-input-area {debugLayout?'border-2 border-green-500':''}">
                    <CommentInput bind:this={commentInput} onbuttonclicked={onCommentInputButton} />
                </div>
            </div>

            <!-- Right: comments panel -->
            {#if $allComments.length > 0 || $curSubtitle}
            <div id="comment_list" transition:fade class="comments-panel">
                <!-- Panel header -->
                <div class="comments-panel-header">
                    <span class="comments-panel-title">
                        <i class="fas fa-comments text-xs mr-2 opacity-50"></i>
                        Comments
                        <span class="comment-count">{$allComments.length}</span>
                    </span>
                    {#if countTimedRootComments($allComments) >= 2}
                    <button class="sort-btn" onclick={toggleCommentSort} title="Toggle sort order">
                        <i class="fa fa-sort text-xs mr-1"></i>
                        {commentSortMode === 'timecode' ? $t('comments.sortByTimecode') : $t('comments.sortByDate')}
                    </button>
                    {/if}
                </div>

                <!-- Comments list -->
                <div class="comments-scroll">
                    {#each $allComments as it}
                        <CommentCard
                            indent={it.indent}
                            comment={it.comment}
                            ondisplaycomment={onDisplayComment}
                            ondeletecomment={onDeleteComment}
                            onreplytocomment={onReplyComment}
                            oneditcomment={onEditComment}
                        />
                    {/each}
                </div>

                <!-- Subtitles section -->
                {#if $curVideo.subtitles && $curVideo.subtitles.length > 0}
                <div class="subtitles-section">
                    <div class="subtitles-header">
                        <span class="subtitles-title">
                            <i class="fas fa-closed-captioning text-xs mr-1.5 opacity-50"></i>
                            {$t('status.subtitles')}
                        </span>
                        <button
                            class="upload-sub-btn"
                            title="Upload subtitles"
                            aria-label="Upload subtitles"
                            onclick={onUploadSubtitles}
                        >
                            <i class="fas fa-plus text-[10px] mr-1"></i>Add
                        </button>
                    </div>
                    {#each $curVideo.subtitles as sub}
                        <SubtitleCard
                            sub={sub}
                            isDefault={$curVideo.defaultSubtitleId == sub.id}
                            onchangesubtitle={onSubtitleChange}
                            ondeletesubtitle={onSubtitleDelete}
                            onupdatesubtitle={onSubtitleUpdate}
                        />
                    {/each}
                </div>
                {:else if $curVideo.subtitles && $curVideo.subtitles.length === 0}
                <div class="subtitles-section">
                    <div class="subtitles-header">
                        <span class="subtitles-title">
                            <i class="fas fa-closed-captioning text-xs mr-1.5 opacity-50"></i>
                            {$t('status.subtitles')}
                        </span>
                        <button
                            class="upload-sub-btn"
                            title="Upload subtitles"
                            aria-label="Upload subtitles"
                            onclick={onUploadSubtitles}
                        >
                            <i class="fas fa-plus text-[10px] mr-1"></i>Add
                        </button>
                    </div>
                </div>
                {/if}
            </div>
            {/if}

        </div>

        <!-- Collab dialog -->
        {#if $collabId && !collabDialogAck}
        <div class="collab-overlay">
            <div class="collab-dialog">
                <div class="collab-icon">
                    <i class="fas fa-users text-2xl" style="color: #34D399;"></i>
                </div>
                <h2 class="collab-title">{$t('status.collabActiveTitle')}</h2>
                <div class="collab-body">
                    <p>{$t('status.collabSessionId', {id: $collabId})}</p>
                    <p>{$t('status.collabActionsMirrored')}</p>
                    <p>{$t('status.collabInvite')}</p>
                    <p>{$t('status.collabExit')}</p>
                </div>
                <button class="collab-ok-btn" onclick={preventDefault(()=>collabDialogAck=true)}>
                    {$t('status.collabUnderstood')}
                </button>
            </div>
        </div>
        {/if}

        {:else}

            <!-- ========== Browse / home page ============= -->
            <div class="organizer_page">
                {#each $curPageItems as pit}
                    {#if pit.html}
                        <div class="html-item-wrapper">
                            <RawHtmlItem html={pit.html} />
                        </div>
                    {:else if pit.folderListing}
                        <div class="folder-listing-section">

                            <!-- Upload drop zone -->
                            {#if pit.folderListing.allowUpload}
                                <div class="upload-dropzone">
                                    <FileUpload
                                        postUrl={uploadUrl}
                                        listingData={pit.folderListing.listingData ?? {}}
                                        mediaFileAddedAction={pit.folderListing.mediaFileAddedAction}
                                    >
                                        <div class="upload-inner">
                                            <div class="upload-icon">
                                                <i class="fas fa-cloud-arrow-up text-xl" style="color: #4F8EF7;"></i>
                                            </div>
                                            <p class="upload-label">{$t('status.dropInstruction')}</p>
                                            <p class="upload-hint">Video, audio, or image files</p>
                                        </div>
                                    </FileUpload>
                                </div>
                            {/if}

                            <!-- Media grid -->
                            <FolderListing
                                listingData={pit.folderListing.listingData}
                                items={pit.folderListing.items.map((it)=>({
                                    id: (it.mediaFile?.id ?? it.folder?.id ?? "[BUG: BAD ITEM TYPE]"),
                                    obj: it }))}
                                dragDisabled = {pit.folderListing.allowReordering ? false : true}
                                listPopupActions = {pit.folderListing.popupActions}
                                on:open-item = {openMediaFileListItem}
                                on:reorder-items = {onReorderItems}
                                on:move-to-folder = {onMoveItemsToFolder}
                                on:popup-action = {onMediaFileListPopupAction}
                            />
                        </div>
                    {/if}
                {/each}
            </div>

            <!-- Server messages log -->
            {#if $userMessages.length > 0}
            <div class="messages-section">
                <h2 class="messages-title">
                    <i class="fas fa-bell text-sm mr-2 opacity-50"></i>
                    {$t('status.latestMessages')}
                </h2>
                <div class="messages-list" role="log">
                    {#each $userMessages as msg}
                    <UserMessage {msg} />
                    {/each}
                </div>
            </div>
            {/if}

            {/if}
        </div>
    </div>
</main>


<style>
/* App shell */
.app-shell {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    background: #0B0F14;
    overflow: hidden;
}

.app-content {
    flex: 1;
    width: 100%;
    overflow: auto;
    position: relative;
}

/* ========================
   Hero / Connecting screen
======================== */
.hero-screen {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

/* Subtle dot-grid background */
.hero-grid-bg {
    position: absolute;
    inset: 0;
    background-image:
        radial-gradient(circle, #1E2840 1px, transparent 1px);
    background-size: 32px 32px;
    opacity: 0.4;
    pointer-events: none;
}

/* Top radial accent glow */
.hero-glow {
    position: absolute;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 600px;
    background: radial-gradient(ellipse at center,
        rgba(79,142,247,0.08) 0%,
        rgba(123,94,167,0.05) 40%,
        transparent 70%
    );
    pointer-events: none;
}

.hero-inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
    max-width: 560px;
    width: 100%;
    padding: 0 24px;
}

/* Badge */
.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 12px 4px 10px;
    border-radius: 20px;
    background: rgba(79,142,247,0.08);
    border: 1px solid rgba(79,142,247,0.18);
    font-size: 0.72rem;
    font-weight: 500;
    color: #6B9EF7;
    letter-spacing: 0.02em;
}

.hero-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4F8EF7;
    box-shadow: 0 0 8px #4F8EF7;
    animation: badge-pulse 2s ease-in-out infinite;
}
@keyframes badge-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

/* Wordmark */
.hero-title {
    font-size: clamp(2.5rem, 8vw, 4.5rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    background: linear-gradient(135deg, #E8EEFF 0%, #8AABF7 50%, #C4A8FF 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
}

/* Tagline */
.hero-tagline {
    font-size: clamp(1rem, 3vw, 1.35rem);
    font-weight: 500;
    color: #8A9BBD;
    letter-spacing: -0.01em;
    margin: 0;
}

/* Description */
.hero-description {
    font-size: 0.88rem;
    color: #4A5570;
    line-height: 1.6;
    max-width: 440px;
    margin: 0;
}

/* CTAs */
.hero-ctas {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 4px;
}

.hero-btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 11px 24px;
    border-radius: 10px;
    background: linear-gradient(135deg, #4F8EF7, #7B5EA7);
    color: white;
    font-size: 0.88rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 200ms ease;
    box-shadow: 0 0 0 1px rgba(79,142,247,0.3), 0 8px 24px rgba(79,142,247,0.2);
}
.hero-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 0 0 1px rgba(79,142,247,0.5), 0 12px 32px rgba(79,142,247,0.3);
    filter: brightness(1.08);
}
.hero-btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.hero-btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 10px 20px;
    border-radius: 10px;
    background: transparent;
    color: #6B7A99;
    font-size: 0.88rem;
    font-weight: 500;
    border: 1px solid #2A3550;
    text-decoration: none;
    transition: all 200ms ease;
}
.hero-btn-secondary:hover {
    background: #111520;
    color: #C8D3E8;
    border-color: #3A4870;
    transform: translateY(-1px);
}

/* Feature pills */
.hero-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 4px;
}

.hero-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 20px;
    background: #0F1420;
    border: 1px solid #1E2840;
    font-size: 0.7rem;
    color: #4A5570;
    font-weight: 500;
    letter-spacing: 0.01em;
}

/* Connecting status footer */
.hero-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
}

.hero-status-dots {
    display: flex;
    gap: 5px;
}
.hero-status-dots span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #1E2840;
    animation: dot-pulse 1.4s ease-in-out infinite;
}
.hero-status-dots span:nth-child(2) { animation-delay: 0.2s; }
.hero-status-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-pulse {
    0%, 80%, 100% { background: #1E2840; transform: scale(1); }
    40% { background: #4F8EF7; transform: scale(1.25); }
}

.hero-status-text {
    font-size: 0.68rem;
    color: #2A3550;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.conn-error-details {
    width: 100%;
    margin-top: 4px;
}
.conn-error-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    color: #F59E0B;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 150ms;
    list-style: none;
    user-select: none;
    gap: 4px;
}
.conn-error-summary:hover { color: #FCD34D; }
.conn-error-summary::-webkit-details-marker { display: none; }

.conn-error-list {
    margin-top: 8px;
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
}
.conn-error-list li code {
    display: block;
    font-size: 0.65rem;
    color: #F87171;
    background: rgba(248,113,113,0.08);
    padding: 4px 8px;
    border-radius: 5px;
    word-break: break-all;
    font-family: 'SF Mono', 'Fira Code', monospace;
}
.conn-error-hint {
    font-size: 0.65rem;
    color: #3A4259;
    margin-top: 6px;
    text-align: center;
    font-style: italic;
}

/* ========================
   Video review layout
======================== */
.review-layout {
    display: flex;
    height: 100%;
    width: 100%;
}

.player-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.player-area {
    flex: 1;
    background: #000;
    overflow: hidden;
}

.comment-input-area {
    flex: none;
    padding: 10px 12px;
    background: #0D1018;
    border-top: 1px solid #1E2840;
}

/* ========================
   Comments panel
======================== */
.comments-panel {
    display: flex;
    flex-direction: column;
    width: 288px;
    flex-shrink: 0;
    height: 100%;
    background: #0D1018;
    border-left: 1px solid #1E2840;
}

.comments-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #1E2840;
    flex-shrink: 0;
}

.comments-panel-title {
    display: flex;
    align-items: center;
    font-size: 0.78rem;
    font-weight: 600;
    color: #6B7A99;
    flex: 1;
}

.comment-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #1E2840;
    font-size: 0.65rem;
    color: #6B7A99;
    margin-left: 6px;
}

.sort-btn {
    display: flex;
    align-items: center;
    font-size: 0.65rem;
    color: #3A4259;
    background: none;
    border: none;
    padding: 3px 6px;
    border-radius: 5px;
    cursor: pointer;
    transition: all 150ms;
    white-space: nowrap;
}
.sort-btn:hover { background: #1E2840; color: #6B7A99; }

.comments-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.subtitles-section {
    flex-shrink: 0;
    border-top: 1px solid #1E2840;
    padding: 8px;
}

.subtitles-header {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
}

.subtitles-title {
    flex: 1;
    font-size: 0.7rem;
    font-weight: 600;
    color: #6B7A99;
    display: flex;
    align-items: center;
}

.upload-sub-btn {
    display: flex;
    align-items: center;
    font-size: 0.65rem;
    color: #4F8EF7;
    background: rgba(79,142,247,0.08);
    border: 1px solid rgba(79,142,247,0.15);
    padding: 3px 7px;
    border-radius: 5px;
    cursor: pointer;
    transition: all 150ms;
}
.upload-sub-btn:hover { background: rgba(79,142,247,0.15); }

/* ========================
   Collab overlay
======================== */
.collab-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px);
    z-index: 200;
}

.collab-dialog {
    background: #161B2A;
    border: 1px solid #2A3550;
    border-radius: 16px;
    padding: 32px;
    max-width: 400px;
    width: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.6);
}

.collab-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: rgba(52,211,153,0.1);
    border: 1px solid rgba(52,211,153,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
}

.collab-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #34D399;
    text-align: center;
}

.collab-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: center;
}
.collab-body p {
    font-size: 0.8rem;
    color: #8A9BBD;
    line-height: 1.5;
}

.collab-ok-btn {
    margin-top: 8px;
    padding: 10px 28px;
    background: linear-gradient(135deg, #34D399, #059669);
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 200ms ease;
}
.collab-ok-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(52,211,153,0.3);
}

/* ========================
   Browse / home page
======================== */
.html-item-wrapper {
    color: #8A9BBD;
    margin-bottom: 8px;
}

.folder-listing-section {
    margin-bottom: 24px;
}

.upload-dropzone {
    border: 2px dashed #1E2840;
    border-radius: 12px;
    margin-bottom: 16px;
    transition: border-color 200ms ease, background 200ms ease;
    overflow: hidden;
}
.upload-dropzone:hover {
    border-color: #4F8EF7;
    background: rgba(79,142,247,0.03);
}

.upload-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 20px;
    min-height: 80px;
}

.upload-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(79,142,247,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2px;
}

.upload-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: #6B7A99;
}

.upload-hint {
    font-size: 0.72rem;
    color: #3A4259;
}

/* ========================
   Messages section
======================== */
.messages-section {
    padding: 0 2.5rem 2rem;
    margin-top: 8px;
}

.messages-title {
    display: flex;
    align-items: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: #3A4259;
    margin-bottom: 10px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.messages-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
}
</style>
