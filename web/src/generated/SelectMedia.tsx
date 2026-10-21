// Generated from screens/SelectMedia.aui; edit the AUI source.
import { Button, Field, Grid, Heading, Icon, Input, Link, Page, Row, Section, Spacer, Stack, Text } from "@/components/ui"

export function SelectMedia({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page variant="upload-picker">
      <Row variant="upload-header">
        <Button onClick={() => onAction("closeEditor")} variant="upload-icon" aria-label="Close upload"><Icon name="X" size={28} /></Button>
        {data.workspace && (
          <Link href={data.workspace} variant="upload-workspace" workspaceApps={true} aria-label="Open Workspace apps"><Icon name="PanelsTopLeft" size={22} /></Link>
        )}
        <Spacer />
        <Button onClick={() => onAction("mediaSource")} variant="upload-pill">
          <Text>Recents</Text>
          <Icon name="ChevronDown" />
        </Button>
        <Spacer />
        <Button onClick={() => onAction("createText")} variant="upload-pill">
          <Icon name="PenLine" />
          <Text>Text</Text>
        </Button>
      </Row>
      <Row variant="media-tabs">
        {data.tabs.map((item, i) => (
          <Button key={i} onClick={() => onAction("mediaTab")} item={item.id} variant={item.variant} aria-pressed={item.active}>{item.title}</Button>
        ))}
      </Row>
      <Stack variant="picker-library">
        {data.emptyLibrary && (
          <Stack variant="picker-empty">
            <Icon name="Images" size={48} />
            <Heading level={1}>Choose your moments</Heading>
            <Text>Add videos or photos from your device.</Text>
            <Field label="Add media"><Input name="files" type="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/gif" multiple={true} /></Field>
            <Button onClick={() => onAction("openEditor")} variant="upload-pill">Create a video</Button>
          </Stack>
        )}
        <Grid variant="media-gallery" columns={3}>
          {data.library.map((item, i) => (
            <Button key={i} onClick={() => onAction("toggleMedia")} item={item.key} variant={item.variant} aria-label={item.label} aria-pressed={item.picked}>
              <Section id="media-thumbnail" item={item} />
              <Text variant="media-duration">{item.durationLabel}</Text>
              <Text variant="selection-number">{item.number}</Text>
            </Button>
          ))}
        </Grid>
      </Stack>
      <Stack variant="picker-bottom">
        {data.hasLibrary && (
          <Field label="Add more media"><Input name="files" type="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/gif" multiple={true} /></Field>
        )}
        <Row variant="selected-media">
          {data.clips.map((item, i) => (
            <Button key={i} onClick={() => onAction("toggleMedia")} item={item.key} variant="selected-thumbnail" aria-label={item.removeLabel}>
              <Section id="media-thumbnail" item={item} />
              <Icon name="X" size={16} />
              <Text variant="media-duration">{item.durationLabel}</Text>
            </Button>
          ))}
        </Row>
        <Row variant="upload-footer">
          <Button onClick={() => onAction("openEditor")} variant="upload-secondary">
            <Icon name="Scissors" />
            <Text>Edit / Create</Text>
          </Button>
          <Button onClick={() => onAction("previewMedia")} variant="upload-primary" disabled={data.noClips}>{data.nextLabel}</Button>
        </Row>
      </Stack>
    </Page>
  )
}
