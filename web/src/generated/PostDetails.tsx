// Generated from screens/PostDetails.aui; edit the AUI source.
import { Alert, Button, Divider, Icon, Input, Link, Page, Row, Section, Spacer, Stack, Text } from "@/components/ui"

export function PostDetails({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page variant="upload-post">
      <Row variant="upload-header">
        <Button onClick={() => onAction("previewMedia")} variant="upload-icon" aria-label="Back to preview"><Icon name="ChevronLeft" size={30} /></Button>
        {data.workspace && (
          <Link href={data.workspace} variant="upload-workspace" workspaceApps={true} aria-label="Open Workspace apps"><Icon name="PanelsTopLeft" size={22} /></Link>
        )}
        <Spacer />
        <Text>{data.kindLabel}</Text>
      </Row>
      <Stack variant="post-scroll">
        <Row variant="post-description">
          <Input name="caption" multiline={true} placeholder="Add description…" aria-label="Caption" maxLength={2200} />
          <Button onClick={() => onAction("coverOptions")} variant="post-cover" aria-label="Edit cover">
            <Section id="media-thumbnail" item={data.cover} />
            <Text variant="cover-top">Preview</Text>
            <Text variant="cover-bottom">Edit cover</Text>
          </Button>
        </Row>
        <Row variant="post-chips">
          <Button onClick={() => onAction("hashtag")} variant="upload-pill"># Hashtags</Button>
          <Button onClick={() => onAction("mention")} variant="upload-pill">@ Mention</Button>
        </Row>
        <Divider />
        <Button onClick={() => onAction("locationOptions")} variant="post-option">
          <Icon name="MapPin" size={26} />
          <Text>Location</Text>
          <Spacer />
          <Text variant="option-value">{data.locationLabel}</Text>
          <Icon name="ChevronRight" />
        </Button>
        <Button onClick={() => onAction("linkOptions")} variant="post-option">
          <Icon name="SquarePlus" size={26} />
          <Text>Add link</Text>
          <Spacer />
          <Icon name="ChevronRight" />
        </Button>
        <Button onClick={() => onAction("audienceOptions")} variant="post-option">
          <Icon name="Globe2" size={26} />
          <Text>{data.audienceLabel}</Text>
          <Spacer />
          <Icon name="ChevronRight" />
        </Button>
        <Button onClick={() => onAction("privacyOptions")} variant="post-option">
          <Icon name="LockKeyhole" size={26} />
          <Stack>
            <Text>Privacy settings</Text>
            <Text variant="option-hint">Manage comments and remixing.</Text>
          </Stack>
          <Spacer />
          <Icon name="ChevronRight" />
        </Button>
        <Button onClick={() => onAction("moreOptions")} variant="post-option">
          <Icon name="Settings2" size={26} />
          <Text>More options</Text>
          <Spacer />
          <Text variant="option-value">{data.scheduleLabel}</Text>
          <Icon name="ChevronRight" />
        </Button>
        <Button onClick={() => onAction("shareOptions")} variant="post-option">
          <Icon name="Share2" size={26} />
          <Text>Share to</Text>
          <Spacer />
          <Text variant="option-value">My Clips</Text>
          <Icon name="ChevronRight" />
        </Button>
        {data.renderStatus && (
          <Alert>{data.renderStatus}</Alert>
        )}
      </Stack>
      <Row variant="upload-footer">
        <Button onClick={() => onAction("saveDraft")} variant="upload-secondary">
          <Icon name="Archive" />
          <Text>Drafts</Text>
        </Button>
        <Button onClick={() => onAction("publishClip")} variant="upload-primary" disabled={data.noClips}>
          <Icon name="ArrowUpCircle" />
          <Text>{data.postLabel}</Text>
        </Button>
      </Row>
    </Page>
  )
}
