#[derive(Debug, Clone)]
pub enum ProgressUpdate {
    StageStarted {
        stage: String,
    },
    TaskStarted {
        task: String,
        total: Option<u64>,
    },
    TaskProgress {
        task: String,
        current: u64,
        total: Option<u64>,
    },
    TaskFinished {
        task: String,
    },
    BytesReceived {
        bytes: u64,
    },
    Complete,
}

impl ProgressUpdate {
    pub fn fraction(&self) -> f32 {
        match self {
            ProgressUpdate::StageStarted { .. } => 0.0,
            ProgressUpdate::TaskStarted { .. } => 0.0,
            ProgressUpdate::TaskProgress {
                current,
                total: Some(total),
                ..
            } => {
                if *total > 0 {
                    *current as f32 / *total as f32
                } else {
                    0.0
                }
            }
            ProgressUpdate::TaskProgress { .. } => -1.0,
            ProgressUpdate::TaskFinished { .. } => 1.0,
            ProgressUpdate::BytesReceived { .. } => -1.0,
            ProgressUpdate::Complete => 1.0,
        }
    }

    pub fn stage_message(&self) -> String {
        match self {
            ProgressUpdate::StageStarted { stage } => stage.clone(),
            ProgressUpdate::TaskStarted { task, .. } => format!("Starting {task}..."),
            ProgressUpdate::TaskProgress {
                task,
                current,
                total,
            } => {
                if let Some(total) = total {
                    format!("{task}: {current}/{total}")
                } else {
                    format!("{task}: {current} bytes")
                }
            }
            ProgressUpdate::TaskFinished { task } => format!("{task} complete"),
            ProgressUpdate::BytesReceived { bytes } => format!("{bytes} bytes received"),
            ProgressUpdate::Complete => "Installation complete".into(),
        }
    }
}
