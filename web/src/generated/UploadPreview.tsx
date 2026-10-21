// Generated from screens/UploadPreview.aui; edit the AUI source.
import { Button, Icon, Link, Page, Row, Section, Spacer, Stack, Text } from "@/components/ui"

export function UploadPreview({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page variant="upload-preview">
      <Stack variant="preview-canvas">
        <Section id="editor-preview" />
        <Row variant="preview-header">
          <Button onClick={() => onAction("selectMedia")} variant="upload-icon" aria-label="Back to media"><Icon name="ChevronLeft" size={30} /></Button>
          {data.workspace && (
            <Link href={data.workspace} variant="upload-workspace" workspaceApps={true} aria-label="Open Workspace apps"><Icon name="PanelsTopLeft" size={22} /></Link>
          )}
          <Spacer />
          {data.video && (
            <Button onClick={() => onAction("editSound")} variant="preview-pill">
              <Icon name="Music2" />
              <Text>Add sound</Text>
            </Button>
          )}
          <Spacer />
        </Row>
        <Stack variant="preview-tools">
          <Button onClick={() => onAction("openEditor")} variant="preview-tool" aria-label="Edit video">
            <Icon name="SlidersHorizontal" size={29} />
            <Text>Edit</Text>
          </Button>
          {data.video && (
            <>
              <Button onClick={() => onAction("editText")} variant="preview-tool" aria-label="Add text">
                <Icon name="Type" size={29} />
                <Text>Text</Text>
              </Button>
              <Button onClick={() => onAction("editStyle")} variant="preview-tool" aria-label="Filters and effects">
                <Icon name="Sparkles" size={29} />
                <Text>Effects</Text>
              </Button>
            </>
          )}
        </Stack>
        {data.multiple && (
          <Row variant="preview-clips">
            {data.clips.map((item, i) => (
              <Button key={i} onClick={() => onAction("selectClip")} item={item.key} variant={item.variant} aria-label={item.name}><Section id="media-thumbnail" item={item} /></Button>
            ))}
          </Row>
        )}
        {data.edited && (
          <Text variant="preview-note">Your edits are prepared automatically when you post.</Text>
        )}
      </Stack>
      <Row variant="upload-footer">
        <Button onClick={() => onAction("storyDetails")} variant="upload-secondary">
          <Icon name="CirclePlus" />
          <Text>Your Story</Text>
        </Button>
        <Button onClick={() => onAction("postDetails")} variant="upload-primary">Next</Button>
      </Row>
    </Page>
  )
}
