// Generated from screens/Editor.aui; edit the AUI source.
import { Alert, Badge, Button, Card, Checkbox, Field, Grid, Heading, Icon, Input, Page, Row, Section, Select, Spacer, Stack, Text } from "@/components/ui"

export function Editor({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack variant="editor-page">
        <Row variant="page-heading">
          <Button onClick={() => onAction("closeEditor")} variant="icon" aria-label="Close editor"><Icon name="ArrowLeft" /></Button>
          <Stack>
            <Text variant="eyebrow">CREATE SOMETHING YOU</Text>
            <Heading level={1}>Your next clip</Heading>
          </Stack>
          <Spacer />
          <Button onClick={() => onAction("saveDraft")} variant="secondary">Save draft</Button>
        </Row>
        <Row variant="stepper">
          <Text>01  Capture</Text>
          <Icon name="ChevronRight" size={16} />
          <Text>02  Make it yours</Text>
          <Icon name="ChevronRight" size={16} />
          <Text>03  Share</Text>
        </Row>
        <Grid variant="editor-grid" columns={2}>
          <Stack variant="preview-column">
            <Section id="editor-preview" />
            <Row>
              <Button onClick={() => onAction("record")} variant="secondary">Record</Button>
              <Field label="Add clips"><Input name="files" type="file" accept="video/mp4,video/webm" multiple={true} /></Field>
            </Row>
            {data.clips.map((item, i) => (
              <Row key={i} variant="clip-row">
                <Button onClick={() => onAction("selectClip")} item={item.key} variant={item.variant}>{item.name}</Button>
                <Text variant="caption">{item.durationLabel}</Text>
                <Button onClick={() => onAction("clipUp")} item={item.key} variant="icon" aria-label="Move clip earlier"><Icon name="ArrowUp" /></Button>
                <Button onClick={() => onAction("removeClip")} item={item.key} variant="icon" aria-label="Remove clip"><Icon name="X" /></Button>
              </Row>
            ))}
            {data.noClips && (
              <Card variant="drop-card">
                <Icon name="UploadCloud" size={38} />
                <Heading level={2}>Start with a moment</Heading>
                <Text>Choose videos or use your camera. Originals are saved in your protected Drive library.</Text>
              </Card>
            )}
            {data.remixLabel && (
              <Alert>{data.remixLabel}</Alert>
            )}
          </Stack>
          <Stack variant="editing-controls">
            <Card>
              <Row>
                <Icon name="Scissors" />
                <Heading level={2}>Trim & style</Heading>
                <Badge>{data.durationLabel}</Badge>
              </Row>
              <Row>
                <Field label="Start (seconds)"><Input name="trimStart" type="number" min={0} step={0.1} /></Field>
                <Field label="End (seconds)"><Input name="trimEnd" type="number" min={0.1} step={0.1} /></Field>
                <Field label="Speed"><Select name="speed" options={data.speeds} /></Field>
              </Row>
              <Row>
                <Field label="Filter"><Select name="filter" options={data.filters} /></Field>
                <Checkbox name="flip">Mirror</Checkbox>
              </Row>
              <Button onClick={() => onAction("applyClip")} variant="secondary">Apply to selected clip</Button>
            </Card>
            <Card>
              <Row>
                <Icon name="Music2" />
                <Heading level={2}>Find your sound</Heading>
              </Row>
              <Field label="Soundtrack"><Select name="sound" options={data.soundOptions} /></Field>
              <Section id="sound-preview" />
              <Row>
                <Field label="Sound start (seconds)"><Input name="soundStart" type="number" min={0} step={0.1} /></Field>
                <Field label="Music volume"><Input name="soundVolume" type="range" min={0} max={1} step={0.05} /></Field>
                <Field label="Original volume"><Input name="originalVolume" type="range" min={0} max={1} step={0.05} /></Field>
              </Row>
              <Row>
                <Button onClick={() => onAction("music")} variant="secondary">My Music library</Button>
                <Button onClick={() => onAction("voiceover")} variant="secondary">Record voiceover</Button>
              </Row>
              <Field label="Import your audio"><Input name="audioFile" type="file" accept="audio/*" /></Field>
              <Checkbox name="audioRights">I have permission to use this audio in my videos</Checkbox>
              <Button onClick={() => onAction("importAudio")} variant="secondary">Add selected audio</Button>
              {data.voiceLabel && (
                <Text>{data.voiceLabel}</Text>
              )}
              <Text variant="caption">Default sounds by Kenney · CC0</Text>
            </Card>
            <Card>
              <Row>
                <Icon name="Type" />
                <Heading level={2}>Text & captions</Heading>
              </Row>
              <Field label="Text or emoji sticker"><Input name="overlayText" placeholder="Say something…" multiline={true} /></Field>
              <Row>
                <Field label="From (seconds)"><Input name="textStart" type="number" min={0} step={0.1} /></Field>
                <Field label="To (seconds)"><Input name="textEnd" type="number" min={0} step={0.1} /></Field>
                <Field label="Size"><Input name="textSize" type="number" min={16} max={72} /></Field>
              </Row>
              <Row>
                <Field label="Horizontal position"><Input name="textX" type="range" min={0} max={1} step={0.05} /></Field>
                <Field label="Vertical position"><Input name="textY" type="range" min={0} max={1} step={0.05} /></Field>
              </Row>
              <Button onClick={() => onAction("addText")} variant="secondary">Add timed text</Button>
              {data.overlays.map((item, i) => (
                <Row key={i}>
                  <Text>{item.label}</Text>
                  <Button onClick={() => onAction("removeText")} item={item.key} variant="icon" aria-label="Remove text"><Icon name="X" /></Button>
                </Row>
              ))}
            </Card>
            <Card>
              <Row>
                <Icon name="Send" />
                <Heading level={2}>Ready when you are</Heading>
              </Row>
              <Field label="Caption"><Input name="caption" placeholder="Describe your clip… #moments" multiline={true} /></Field>
              <Field label="Who can watch"><Select name="visibility" options={data.audiences} /></Field>
              <Row>
                <Checkbox name="allowComments">Comments</Checkbox>
                <Checkbox name="allowRemix">Duet & Stitch</Checkbox>
              </Row>
              <Field label="Schedule (optional)"><Input name="publishAt" type="datetime-local" /></Field>
              <Text variant="caption">Rendering applies your edits and prepares three streaming qualities.</Text>
              <Row>
                <Button onClick={() => onAction("renderClip")} variant="secondary">Render preview</Button>
                <Button onClick={() => onAction("publishClip")} variant="create" disabled={data.cannotPublish}>Post clip</Button>
              </Row>
              {data.renderStatus && (
                <Alert>{data.renderStatus}</Alert>
              )}
            </Card>
          </Stack>
        </Grid>
      </Stack>
    </Page>
  )
}
